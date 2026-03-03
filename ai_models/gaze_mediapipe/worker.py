"""
worker.py — Lógica de Negocio del Worker de Gaze Tracking
==========================================================
Responsabilidad: análisis de buffer de mirada (heurísticas + DBSCAN +
Isolation Forest), generación de soft evidence.
NO conoce RabbitMQ ni colas — eso es trabajo de main.py.
"""

import logging
from datetime import datetime, timezone

from analyzer import analyze_gaze_buffer
from soft_evidence import normalizar_gaze

logger = logging.getLogger("GazeTrackingWorker")


def procesar_gaze(student_id: str, session_id: str, buffer_coordenadas: list) -> dict | None:
    """
    Pipeline completo de gaze: validación → análisis IA → soft evidence.

    Args:
        student_id:         ID del estudiante.
        session_id:         ID de la sesión de examen.
        buffer_coordenadas: Lista de tuplas [(x1,y1), (x2,y2), ...] con
                            las coordenadas de mirada del buffer temporal.

    Returns:
        dict con el evento universal de soft evidence listo para encolar,
        o None si los datos son insuficientes o irrecuperables.
    """
    # 1. Validar datos suficientes
    if not buffer_coordenadas or len(buffer_coordenadas) < 15:
        logger.info(f"Buffer muy corto para {student_id}, ignorando...")
        return None

    # 2. Análisis con la IA (Heurísticas + DBSCAN + Isolation Forest)
    #    Retorna métricas crudas: oob_ratio, secondary_cluster_ratio, anomaly_ratio
    resultado_ia = analyze_gaze_buffer(buffer_coordenadas)

    # Ignorar si los datos son irrecuperables
    if resultado_ia["status"] in ("insufficient_data", "too_much_noise"):
        return None

    # 3. Generar distribución de probabilidad (Soft Evidence)
    #    normalizar_gaze() aplica pesos relativos + normalización L1
    distribucion = normalizar_gaze(
        oob_ratio=resultado_ia["oob_ratio"],
        secondary_cluster_ratio=resultado_ia["secondary_cluster_ratio"],
        anomaly_ratio=resultado_ia["anomaly_ratio"],
    )

    # 4. Construir evento en formato universal de Soft Evidence
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "userId": student_id,
        "sessionId": session_id,
        "source": "gaze_tracker",
        "evidence_type": "soft",
        "soft_evidence": distribucion,
        "details": {
            "oob_ratio": resultado_ia["oob_ratio"],
            "secondary_cluster_ratio": resultado_ia["secondary_cluster_ratio"],
            "anomaly_ratio": resultado_ia["anomaly_ratio"],
        }
    }
