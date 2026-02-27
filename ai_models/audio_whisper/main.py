import json
import logging
import time
import redis
import pika
import requests
import os
import numpy as np
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv() # Carga las variables del archivo .env automáticamente
# Importar tus módulos de Inteligencia Artificial
import audiocleaner as audio_cleaner
import transcriber
from analyzer_semantic import analyzer_service

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

logger = logging.getLogger("AudioWorker")
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

# --- 3. FUNCIONES AUXILIARES ---
def descargar_audio_bytes(url):
    """Descarga el chunk de audio desde Azure Blob Storage (o URL pública)"""
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        return response.content
    except Exception as e:
        logger.error(f"Error descargando audio de {url}: {e}")
        return None

# --- 4. CALLBACK DE RABBITMQ ---
def procesar_mensaje_rabbit(ch, method, properties, body):
    try:
        # 1. Parsear el mensaje entrante
        payload = json.loads(body)
        student_id = payload.get("student_id")
        session_id = payload.get("session_id")
        audio_url = payload.get("audio_url")
        chunk_index = payload.get("chunk_index", 0)

        # 2. Descargar el audio
        audio_bytes = descargar_audio_bytes(audio_url)
        if audio_bytes is None:
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # 3. Convertir y procesar
        audio_np = audio_cleaner.convertir_a_numpy(audio_bytes)
        if audio_np is None:
            logger.warning("Error convirtiendo bytes a numpy.")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # FILTRO 1: Silencio (Evita gastar CPU de la IA)
        if audio_cleaner.es_silencio(audio_np, umbral_db=-45):
            # Es silencio, no reportamos nada para no saturar la base de datos
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # FILTRO 2: Voz Humana
        audio_filtrado = audio_cleaner.aplicar_filtro_voz(audio_np)

        # 4. Transcripción (STT)
        texto = transcriber.transcribir_audio(audio_filtrado)
        if not texto or len(texto.strip()) < 2:
            # Puro ruido de fondo, lo ignoramos
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # 5. Análisis Semántico de NLP
        analisis = analyzer_service.analizar(texto)

        # 6. Mapeo al Formato Universal
        # "SOSPECHOSO" = CRITICAL, "DOMESTICO/NEUTRAL" = INFO (o WARNING si eres muy estricto con el ruido)
        severidad = "CRITICAL" if analisis["category"] == "SOSPECHOSO" else "INFO"

        evento_universal = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "userId": student_id,
            "sessionId": session_id,
            "source": "audio_nlp",
            "severity": severidad,
            "event_type": "speech_detected",
            "details": {
                "transcript": texto,
                "intent_category": analisis["category"],
                "suspicion_score": analisis["score"]
            }
        }

        # 7. Guardar en Redis
        if redis_client:
            redis_key = f"proctoring:session_{session_id}:user_{student_id}"
            try:
                redis_client.rpush(redis_key, json.dumps(evento_universal))
            except redis.RedisError as e:
                logger.error(f"Fallo al escribir en Redis: {e}")

        # Logging en consola
        if severidad == "CRITICAL":
            logger.warning("Voz sospechosa detectada", extra={"payload": evento_universal})
        else:
            logger.info("Voz doméstica detectada", extra={"payload": evento_universal})

        # 8. Confirmar a RabbitMQ
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        logger.error(f"Error procesando mensaje: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

# --- 5. INICIALIZAR RABBITMQ CON RETRY ---
def iniciar_worker():
    RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'localhost')
    QUEUE_NAME = 'q_audios' # <--- Cola exclusiva para el análisis de Audio
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
            
            channel.queue_declare(queue=QUEUE_NAME, durable=True)
            # Prefetch de 1 para que un solo worker de audio no acapare la RAM con múltiples audios pesados
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=procesar_mensaje_rabbit)

            retry_delay = 5  # Reset del backoff al conectar exitosamente
            print(f"[*] Worker Audio (Whisper + NLP) iniciado. Esperando URLs en '{QUEUE_NAME}'...")
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