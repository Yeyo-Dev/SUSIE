import json
import logging
import time
import redis
import pika
import cv2
import numpy as np
import requests
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv() # Carga las variables del archivo .env automáticamente
# Importamos tu lógica de YOLO
import vision_logic

# --- 1. CONFIGURACIÓN DEL LOGGER ESTRUCTURADO ---
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage()
        }
        if hasattr(record, 'payload'):
            log_obj.update(record.payload)
        return json.dumps(log_obj)

logger = logging.getLogger("YoloVisionWorker")
logger.setLevel(logging.INFO)
console_handler = logging.StreamHandler()
console_handler.setFormatter(JSONFormatter())
logger.addHandler(console_handler)

# --- 2. CONFIGURACIÓN DE REDIS ---
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))

try:
    redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    redis_client.ping()
    print(f"[*] Conectado a Redis en {REDIS_HOST}:{REDIS_PORT}")
except redis.ConnectionError:
    print(f"[!] ADVERTENCIA: No se pudo conectar a Redis.")
    redis_client = None

# --- 3. LÓGICA DE DESCARGA ---
def load_image(url):
    """Descarga la imagen de Azure Blob Storage"""
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status() 
        image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
        return cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    except Exception as e:
        logger.error(f"Error descargando imagen de {url}: {e}")
        return None

# --- 4. CALLBACK DE RABBITMQ (Lo que pasa cuando llega un mensaje) ---
def procesar_mensaje_rabbit(ch, method, properties, body):
    try:
        # 1. Leer el mensaje que mandó tu compañero
        payload = json.loads(body)
        student_id = payload.get("student_id")
        session_id = payload.get("session_id")
        image_url = payload.get("image_url")

        logger.info(f"Procesando frame de {student_id} desde Azure...")

        # 2. Descargar la imagen
        image_np = load_image(image_url)
        if image_np is None:
            # Si falla la descarga, le decimos a RabbitMQ que ya terminamos para que no se cicle
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # 3. Análisis YOLO
        resultado_vision = vision_logic.analizar_frame(image_np)
        
        # 4. Mapeo al Formato Universal
        yolo_status = resultado_vision["status"]
        if yolo_status == "CHEATING_SUSPECTED":
            severidad = "CRITICAL"
        elif yolo_status == "DISTRACTED":
            severidad = "WARNING"
        else:
            severidad = "INFO"

        flags = resultado_vision["details"].get("flags", [])
        event_type = ", ".join(flags) if flags else "focused_person"

        evento_universal = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "userId": student_id,
            "sessionId": session_id,
            "source": "yolo_vision",
            "severity": severidad,
            "event_type": event_type,
            "details": {
                "description": f"Análisis YOLO completado. Score: {resultado_vision['suspicion_score']}",
                "persons_detected": resultado_vision["details"]["persons"],
                "phones_detected": resultado_vision["details"]["phones"]
            }
        }

        # 5. Guardar en Redis
        if redis_client:
            redis_key = f"proctoring:session_{session_id}:user_{student_id}"
            try:
                redis_client.rpush(redis_key, json.dumps(evento_universal))
            except redis.RedisError as e:
                logger.error(f"Fallo al escribir en Redis: {e}")

        if severidad in ["WARNING", "CRITICAL"]:
            logger.warning("Alerta visual detectada", extra={"payload": evento_universal})

        # 6. Confirmar a RabbitMQ que el trabajo fue exitoso para que borre el mensaje de la cola
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        logger.error(f"Error procesando mensaje: {e}")
        # Si hay un error crítico, rechazamos el mensaje para que RabbitMQ lo reintente después
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

# --- 5. INICIALIZAR RABBITMQ CON RETRY ---
def iniciar_worker():
    RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'localhost')
    QUEUE_NAME = 'q_snapshots' # <--- Ponte de acuerdo con tu compañero en este nombre
    MAX_BACKOFF = 60  # Segundos máximos entre reintentos
    retry_delay = 5   # Delay inicial en segundos

    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                heartbeat=600,
                blocked_connection_timeout=300
            ))
            channel = connection.channel()
            
            # Declaramos la cola (por si acaso, esto asegura que exista)
            channel.queue_declare(queue=QUEUE_NAME, durable=True)
            
            # Le decimos a RabbitMQ: "Envíame 1 mensaje a la vez, no me satures"
            channel.basic_qos(prefetch_count=1)
            
            # Conectamos la cola con nuestra función procesar_mensaje_rabbit
            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=procesar_mensaje_rabbit)

            retry_delay = 5  # Reset del backoff al conectar exitosamente
            print(f"[*] Worker YOLOv8 iniciado. Esperando URLs en la cola '{QUEUE_NAME}'...")
            channel.start_consuming()
            
        except pika.exceptions.AMQPConnectionError:
            logger.warning(f"No se pudo conectar a RabbitMQ en {RABBITMQ_HOST}. Reintentando en {retry_delay}s...")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, MAX_BACKOFF)

        except KeyboardInterrupt:
            print("[*] Worker detenido manualmente.")
            break

        except Exception as e:
            logger.error(f"Error inesperado en el worker: {e}. Reconectando en {retry_delay}s...")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, MAX_BACKOFF)

if __name__ == "__main__":
    iniciar_worker()