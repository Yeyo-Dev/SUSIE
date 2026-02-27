import json
import logging
import redis
import pika
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv() # Carga las variables del archivo .env automáticamente
from analyzer import analyze_gaze_buffer

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

logger = logging.getLogger("GazeTrackingWorker")
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

# --- 3. CALLBACK DE RABBITMQ ---
def procesar_mensaje_rabbit(ch, method, properties, body):
    try:
        # 1. Leer el mensaje de la cola
        payload = json.loads(body)
        student_id = payload.get("student_id")
        session_id = payload.get("session_id")
        buffer_coordenadas = payload.get("gaze_buffer", [])

        # Validar que vengan datos
        if not buffer_coordenadas or len(buffer_coordenadas) < 15:
            logger.info(f"Buffer muy corto para {student_id}, ignorando...")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # 2. Análisis con la IA (DBSCAN + Isolation Forest)
        resultado_ia = analyze_gaze_buffer(buffer_coordenadas)
        
        # Ignorar si es puro ruido para no llenar Redis de basura
        if resultado_ia["status"] == "too_much_noise":
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # 3. Mapeo al Formato Universal
        severidad = "INFO"
        if resultado_ia["status"] == "alert":
            severidad = "WARNING" # Para el Gaze es Warning, se vuelve CRITICAL si el motor de inferencia lo cruza con YOLO/Audio

        evento_universal = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "userId": student_id,
            "sessionId": session_id,
            "source": "gaze_tracker",
            "severity": severidad,
            "event_type": resultado_ia.get("reason", "unknown"),
            "details": {
                "description": resultado_ia.get("details", "")
            }
        }

        # 4. Guardar en Redis
        if redis_client:
            redis_key = f"proctoring:session_{session_id}:user_{student_id}"
            try:
                redis_client.rpush(redis_key, json.dumps(evento_universal))
            except redis.RedisError as e:
                logger.error(f"Fallo al escribir en Redis: {e}")

        # Logging en consola
        if severidad in ["WARNING", "CRITICAL"]:
            logger.warning("Alerta de mirada detectada", extra={"payload": evento_universal})
        else:
            logger.info("Monitoreo visual normal", extra={"payload": evento_universal})

        # 5. Confirmar a RabbitMQ que ya procesamos este lote
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        logger.error(f"Error procesando mensaje: {e}")
        # Rechazamos para reintentar si hay un error de código
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

# --- 4. INICIALIZAR RABBITMQ ---
def iniciar_worker():
    RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'localhost')
    QUEUE_NAME = 'gaze_tasks_queue' # <--- Cola exclusiva para el Gaze Tracker
    
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
        channel = connection.channel()
        
        channel.queue_declare(queue=QUEUE_NAME, durable=True)
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=QUEUE_NAME, on_message_callback=procesar_mensaje_rabbit)

        print(f"[*] Worker Gaze Tracking (DBSCAN/IsolationForest) iniciado. Esperando lotes en '{QUEUE_NAME}'...")
        channel.start_consuming()
        
    except pika.exceptions.AMQPConnectionError:
        print(f"[!] No se pudo conectar a RabbitMQ en {RABBITMQ_HOST}. Reintentando...")

if __name__ == "__main__":
    iniciar_worker()