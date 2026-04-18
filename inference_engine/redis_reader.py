"""
redis_reader.py — Lectura de logs desde Redis
===============================================
Lee todos los eventos almacenados por los workers de IA
y los eventos del navegador para una sesión específica.

Los workers usan RPUSH para escribir, nosotros usamos LRANGE para leer.
"""

import json
import logging
import redis
from config import REDIS_HOST, REDIS_PORT, REDIS_DB

logger = logging.getLogger("InferenceEngine.RedisReader")

_redis_pool = None


def _get_redis() -> redis.Redis:
    """Retorna instancia de Redis con pool de conexiones."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.ConnectionPool(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            decode_responses=True,
        )
    return redis.Redis(connection_pool=_redis_pool)


def leer_logs_sesion(sesion_id: int | str, user_id: int | str) -> list[dict]:
    """
    Lee TODOS los logs de una sesión desde Redis usando LRANGE.

    Key pattern: logs:{sesion_id}:{user_id}

    Returns:
        Lista de dicts con todos los eventos (workers IA + browser events),
        ordenados cronológicamente (por orden de inserción RPUSH).
    """
    r = _get_redis()
    key = f"logs:{sesion_id}:{user_id}"

    try:
        raw_events = r.lrange(key, 0, -1)
        eventos = []
        for raw in raw_events:
            try:
                eventos.append(json.loads(raw))
            except json.JSONDecodeError:
                logger.warning(f"Evento malformado en Redis (key={key}): {raw[:100]}")
                continue

        logger.info(f"Leídos {len(eventos)} eventos de Redis para sesión {sesion_id}, usuario {user_id}")
        return eventos

    except Exception as e:
        logger.error(f"Error leyendo logs de Redis: {e}")
        return []


def limpiar_logs_sesion(sesion_id: int | str, user_id: int | str) -> bool:
    """
    Elimina la key de logs de Redis después de procesar.
    Esto libera memoria una vez que la data fue empaquetada y subida a Azure.
    """
    r = _get_redis()
    key = f"logs:{sesion_id}:{user_id}"

    try:
        deleted = r.delete(key)
        logger.info(f"Redis key '{key}' eliminada ({deleted} keys)")
        return True
    except Exception as e:
        logger.error(f"Error limpiando Redis: {e}")
        return False


def contar_logs_sesion(sesion_id: int | str, user_id: int | str) -> int:
    """Retorna la cantidad de logs almacenados para una sesión."""
    r = _get_redis()
    key = f"logs:{sesion_id}:{user_id}"
    try:
        return r.llen(key)
    except Exception:
        return 0
