"""
worker.py — Lógica de Negocio del Worker de Visión (YOLOv8 Nano)
=================================================================
Responsabilidad: descarga de imagen, análisis YOLO, generación de
soft evidence. NO conoce RabbitMQ ni colas — eso es trabajo de main.py.
"""

import cv2
import numpy as np
import requests
import logging
from datetime import datetime, timezone

import vision_logic
from soft_evidence import normalizar_vision

logger = logging.getLogger("YoloVisionWorker")


def descargar_imagen(url: str):
    """
    Descarga una imagen desde Azure Blob Storage y la decodifica
    a un array numpy en formato BGR (OpenCV).

    Returns:
        np.ndarray | None: imagen decodificada o None si falla.
    """
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        image_array = np.asarray(bytearray(response.content), dtype=np.uint8)
        return cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    except Exception as e:
        logger.error(f"Error descargando imagen de {url}: {e}")
        return None


def procesar_frame(student_id: str, session_id: str, image_url: str) -> dict | None:
    """
    Pipeline completo de visión: descarga → YOLO → soft evidence.

    Args:
        student_id: ID del estudiante.
        session_id: ID de la sesión de examen.
        image_url:  URL de la imagen en Azure Blob.

    Returns:
        dict con el evento universal de soft evidence listo para encolar,
        o None si la imagen no se pudo procesar.
    """
    # 1. Descargar la imagen
    image_np = descargar_imagen(image_url)
    if image_np is None:
        return None

    # 2. Análisis YOLO
    resultado_vision = vision_logic.analizar_frame(image_np)

    # 3. Extraer señales crudas
    person_count = resultado_vision["details"]["persons"]
    phone_count = resultado_vision["details"]["phones"]
    phone_confidence = resultado_vision["details"]["max_phone_confidence"]

    # 4. Generar distribución de probabilidad (Soft Evidence)
    #    normalizar_vision() aplica normalización L1 y garantiza Σ = 1.0
    distribucion = normalizar_vision(
        person_count=person_count,
        phone_confidence=phone_confidence,
        phone_detected=(phone_count > 0),
        multi_person=(person_count > 1),
    )

    # 5. Construir evento en formato universal de Soft Evidence
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "userId": student_id,
        "sessionId": session_id,
        "source": "yolo_vision",
        "evidence_type": "soft",
        "soft_evidence": distribucion,
        "details": {
            "persons_detected": person_count,
            "phones_detected": phone_count,
            "phone_confidence": phone_confidence,
            "flags": resultado_vision["details"]["flags"],
        }
    }
