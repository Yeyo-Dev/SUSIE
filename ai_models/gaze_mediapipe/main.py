"""
main.py — Capa de Transporte RabbitMQ (Worker de Gaze Tracking)
================================================================
Responsabilidad EXCLUSIVA: gestión de conexiones, colas y mensajes.
Toda la lógica de negocio vive en worker.py.

Flujo:  q_gaze (entrada) → worker.procesar_gaze() → q_evidencias (salida)
"""

import json
import logging
import time
import pika
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()

from worker import procesar_gaze

# --- LOGGER ESTRUCTURADO ---
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

# --- COLA DE SALIDA ---
QUEUE_OUTPUT = 'q_evidencias'

def publicar_evidencia(channel, evento):
    """Publica el evento de soft evidence en la cola q_evidencias."""
    channel.basic_publish(
        exchange='',
        routing_key=QUEUE_OUTPUT,
        body=json.dumps(evento),
        properties=pika.BasicProperties(
            delivery_mode=2,
            content_type='application/json',
        )
    )

# --- CALLBACK ---
def on_message(ch, method, properties, body):
    try:
        payload = json.loads(body)
        user_id = payload.get("user_id")
        sesion_id = payload.get("sesion_id")
        buffer_coordenadas = payload.get("gaze_buffer", [])

        logger.info(f"Procesando buffer de mirada de {user_id}...")

        # Delegar TODA la lógica al worker
        evento = procesar_gaze(user_id, sesion_id, buffer_coordenadas)

        if evento:
            publicar_evidencia(ch, evento)
            logger.info("Evidencia suave publicada", extra={"payload": evento})

        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        logger.error(f"Error procesando mensaje: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

# --- ARRANQUE CON RETRY ---
def iniciar_worker():
    RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'localhost')
    QUEUE_INPUT = 'q_gaze'
    MAX_BACKOFF = 60
    retry_delay = 5

    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                heartbeat=600,
                blocked_connection_timeout=300
            ))
            channel = connection.channel()

            channel.queue_declare(queue=QUEUE_INPUT, durable=True)
            channel.queue_declare(queue=QUEUE_OUTPUT, durable=True)

            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=QUEUE_INPUT, on_message_callback=on_message)

            retry_delay = 5
            print(f"[*] Worker Gaze Tracking (Soft Evidence) iniciado.")
            print(f"    Consumiendo: '{QUEUE_INPUT}' → Publicando: '{QUEUE_OUTPUT}'")
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError:
            logger.warning(f"RabbitMQ no disponible. Reintentando en {retry_delay}s...")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, MAX_BACKOFF)

        except KeyboardInterrupt:
            print("[*] Worker detenido manualmente.")
            break

        except Exception as e:
            logger.error(f"Error inesperado: {e}. Reconectando en {retry_delay}s...")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, MAX_BACKOFF)

if __name__ == "__main__":
    iniciar_worker()