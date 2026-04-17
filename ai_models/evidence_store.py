"""
evidence_store.py — Persistencia Redis + Filtrado de Infracciones
==================================================================
Módulo compartido por todos los AI Workers.

Responsabilidades:
  1. Guardar TODA la soft evidence en Redis (historial completo).
  2. Calcular el nivel de infracción a partir de la distribución.
  3. Decidir si el evento se publica en q_infracciones (solo medio/alto).

Variables de entorno:
  REDIS_HOST                  — Host de Redis (default: localhost)
  REDIS_PORT                  — Puerto de Redis (default: 6379)
  REDIS_DB                    — Base de datos Redis (default: 0)
  REDIS_EVIDENCE_TTL          — TTL en segundos (default: 86400 = 24h)
  INFRACTION_QUEUE_THRESHOLD  — Umbral mínimo 0.0–1.0 (default: 0.5)
"""

import json
import os
import logging
import redis

logger = logging.getLogger(__name__)

# ── Configuración vía Variables de Entorno ──────────────────────────
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
REDIS_DB = int(os.environ.get("REDIS_DB", "0"))
REDIS_EVIDENCE_TTL = int(os.environ.get("REDIS_EVIDENCE_TTL", "86400"))
INFRACTION_QUEUE_THRESHOLD = float(os.environ.get("INFRACTION_QUEUE_THRESHOLD", "0.5"))

# ── Pool de conexión Redis (singleton) ──────────────────────────────
_redis_pool = None


def _get_redis() -> redis.Redis:
    """
    Retorna una instancia de Redis usando un pool de conexiones.
    El pool se crea una sola vez (singleton) para reutilizar conexiones.
    """
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.ConnectionPool(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            decode_responses=True,
        )
    return redis.Redis(connection_pool=_redis_pool)


# ── Mapeo de estados "normales" por source ──────────────────────────
# Para cada worker, los estados que representan NORMALIDAD.
# El nivel de infracción = 1.0 - Σ P(estados_normales)
_ESTADOS_NORMALES = {
    "yolo_vision":  ["Normal"],
    "audio_nlp":    ["Silencio", "Neutral"],
    "gaze_tracker": ["Concentrado"],
}


def guardar_en_redis(evento: dict) -> bool:
    """
    Guarda un evento de soft evidence en Redis.

    Key:  evidence:{source}:{sesion_id}:{user_id}:{timestamp}
    TTL:  REDIS_EVIDENCE_TTL segundos (default 24h).

    Args:
        evento: Dict con la soft evidence completa del worker.

    Returns:
        True si se guardó correctamente, False si hubo error.
    """
    try:
        r = _get_redis()
        key = (
            f"evidence:{evento['source']}"
            f":{evento['sesion_id']}"
            f":{evento['user_id']}"
            f":{evento['timestamp']}"
        )
        r.setex(key, REDIS_EVIDENCE_TTL, json.dumps(evento))
        logger.debug(f"Redis SET {key} (TTL={REDIS_EVIDENCE_TTL}s)")
        return True
    except Exception as e:
        logger.error(f"Error guardando en Redis: {e}")
        return False


def calcular_nivel_infraccion(source: str, soft_evidence: dict) -> float:
    """
    Calcula el nivel de infracción (0.0–1.0) a partir de la distribución
    de probabilidad.

    Nivel = 1.0 - Σ P(estados_normales)

    Args:
        source:        Identificador del worker (yolo_vision, audio_nlp, gaze_tracker).
        soft_evidence: Dict con la distribución de probabilidad.

    Returns:
        float entre 0.0 (totalmente normal) y 1.0 (infracción segura).

    Raises:
        ValueError: Si el source no es reconocido.
    """
    estados_normales = _ESTADOS_NORMALES.get(source)
    if estados_normales is None:
        raise ValueError(f"Source desconocido: '{source}'. "
                         f"Esperado: {list(_ESTADOS_NORMALES.keys())}")

    prob_normal = sum(soft_evidence.get(estado, 0.0) for estado in estados_normales)
    return round(1.0 - prob_normal, 4)


def debe_encolar(nivel_infraccion: float) -> bool:
    """
    Determina si un evento debe publicarse en q_infracciones
    basándose en el umbral configurable.

    Args:
        nivel_infraccion: Nivel de infracción calculado (0.0–1.0).

    Returns:
        True si el nivel ≥ INFRACTION_QUEUE_THRESHOLD.
    """
    return nivel_infraccion >= INFRACTION_QUEUE_THRESHOLD
