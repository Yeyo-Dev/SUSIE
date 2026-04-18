"""
main.py — Motor de Inferencia SUSIE (Orquestador)
====================================================
Consumer RabbitMQ que escucha en q_evidencia.
Al recibir un mensaje de cierre de sesión, ejecuta el pipeline:

  1. Lee todos los logs de Redis (LRANGE)
  2. Agrupa por ventana temporal (fusión multisensor)
  3. Evalúa cada ventana con la Red Bayesiana (CPT)
  4. Genera dictamen con veredicto + momentos sospechosos
  5. Sube el JSON completo a Azure Blob Storage
  6. Guarda el veredicto resumido en PostgreSQL
  7. Limpia las keys de Redis de la sesión
"""

import json
import logging
import sys
import time
import pika

from config import (
    RABBITMQ_HOST,
    RABBITMQ_PORT,
    RABBITMQ_USER,
    RABBITMQ_PASS,
    QUEUE_INPUT,
)
from redis_reader import leer_logs_sesion, limpiar_logs_sesion, contar_logs_sesion
from fusion import agrupar_por_ventana
from dictamen import generar_dictamen, extraer_resumen_para_bd
from azure_uploader import subir_dictamen
from db_writer import inicializar_tabla, guardar_veredicto
from bayesian_network import validar_cpt

# ── Logger ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("InferenceEngine")


def procesar_sesion(sesion_id, user_id):
    """
    Pipeline completo de inferencia para una sesión finalizada.
    Sigue el diagrama de 3 fases:
      Fase 1 (Hot): Workers ya escribieron en Redis
      Fase 2 (Consolidación): Este método
      Fase 3 (Consulta): El dashboard usa lo que guardamos
    """
    logger.info(f"═══ Inicio de procesamiento: sesion={sesion_id}, user={user_id} ═══")

    # ── Paso 1: Leer todos los logs de Redis ────────────────
    count = contar_logs_sesion(sesion_id, user_id)
    logger.info(f"Logs encontrados en Redis: {count}")

    if count == 0:
        logger.warning(f"No hay logs en Redis para sesion={sesion_id}. Generando dictamen vacío.")

    logs_raw = leer_logs_sesion(sesion_id, user_id)

    # ── Paso 2: Fusión temporal (agrupar por ventana) ───────
    ventanas = agrupar_por_ventana(logs_raw)
    logger.info(f"Ventanas temporales generadas: {len(ventanas)}")

    # ── Paso 3: Generar dictamen (Red Bayesiana + empaquetado)
    dictamen = generar_dictamen(sesion_id, user_id, ventanas, logs_raw)

    # ── Paso 4: Subir JSON completo a Azure Blob Storage ────
    url_azure = subir_dictamen(dictamen, sesion_id, user_id)
    logger.info(f"JSON subido: {url_azure}")

    # ── Paso 5: Guardar veredicto resumido en PostgreSQL ────
    resumen = extraer_resumen_para_bd(dictamen)
    id_dictamen = guardar_veredicto(
        sesion_id=int(sesion_id),
        user_id=int(user_id),
        indice_confiabilidad=dictamen["veredicto"]["indice_confiabilidad"],
        clasificacion=dictamen["veredicto"]["clasificacion"],
        url_azure=url_azure,
        resumen=resumen,
    )

    if id_dictamen:
        logger.info(f"Veredicto guardado: id_dictamen={id_dictamen}")
    else:
        logger.error("Error al guardar veredicto en PostgreSQL")

    # ── Paso 6: Limpiar Redis ───────────────────────────────
    limpiar_logs_sesion(sesion_id, user_id)

    logger.info(
        f"═══ Procesamiento completado: sesion={sesion_id}, "
        f"clasificacion={dictamen['veredicto']['clasificacion']}, "
        f"confiabilidad={dictamen['veredicto']['indice_confiabilidad']:.1%} ═══"
    )

    return dictamen


def on_message(ch, method, properties, body):
    """Callback para mensajes de q_evidencia."""
    try:
        payload = json.loads(body)
        sesion_id = payload.get("sesion_id")
        user_id = payload.get("user_id")

        if not sesion_id or not user_id:
            logger.error(f"Mensaje sin sesion_id o user_id: {payload}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        procesar_sesion(sesion_id, user_id)
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        logger.error(f"Error procesando mensaje: {e}", exc_info=True)
        # No reintentar mensajes que causan excepciones
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def iniciar_motor():
    """Arranca el motor de inferencia con retry y backoff exponencial."""
    MAX_BACKOFF = 60
    retry_delay = 5

    # Validar CPT al arrancar
    logger.info("Validando CPT de la Red Bayesiana...")
    validar_cpt()
    logger.info("CPT validada correctamente (256 combinaciones)")

    # Inicializar tabla en PostgreSQL
    logger.info("Verificando tabla dictamen_sesion en PostgreSQL...")
    try:
        inicializar_tabla()
    except Exception as e:
        logger.error(f"No se pudo inicializar PostgreSQL: {e}. Continuando...")

    # Conectar a RabbitMQ
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)

    while True:
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    port=RABBITMQ_PORT,
                    credentials=credentials,
                    heartbeat=600,
                    blocked_connection_timeout=300,
                )
            )
            channel = connection.channel()

            # Declarar cola de entrada
            channel.queue_declare(queue=QUEUE_INPUT, durable=True)

            # Prefetch = 1 para procesar de a uno (la inferencia es pesada)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=QUEUE_INPUT, on_message_callback=on_message)

            retry_delay = 5
            print("╔══════════════════════════════════════════════════════╗")
            print("║  Motor de Inferencia SUSIE v1.0.0                   ║")
            print("║  Red Bayesiana — 4 nodos, 256 combinaciones CPT     ║")
            print(f"║  Consumiendo: '{QUEUE_INPUT}'                        ║")
            print("╚══════════════════════════════════════════════════════╝")
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError:
            logger.warning(f"RabbitMQ no disponible. Reintentando en {retry_delay}s...")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, MAX_BACKOFF)

        except KeyboardInterrupt:
            print("\n[*] Motor de inferencia detenido manualmente.")
            break

        except Exception as e:
            logger.error(f"Error inesperado: {e}. Reconectando en {retry_delay}s...")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, MAX_BACKOFF)


if __name__ == "__main__":
    iniciar_motor()