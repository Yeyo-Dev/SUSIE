"""
db_writer.py — Persistencia del veredicto en PostgreSQL
=========================================================
Guarda el resumen del dictamen en la base de datos transaccional.
Solo almacena: veredicto + URL de Azure + metadata mínima.

El JSON completo con toda la telemetría vive en Azure Blob Storage.
"""

import json
import logging
import psycopg2
from datetime import datetime, timezone

from config import DATABASE_URL

logger = logging.getLogger("InferenceEngine.DBWriter")

# ── SQL para crear la tabla si no existe ────────────────────
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS dictamen_sesion (
    id_dictamen         BIGSERIAL PRIMARY KEY,
    id_sesion           BIGINT NOT NULL,
    id_usuario          BIGINT NOT NULL,
    indice_confiabilidad DOUBLE PRECISION NOT NULL,
    clasificacion       VARCHAR(20) NOT NULL,
    url_azure_json      TEXT,
    resumen             JSONB,
    fecha_procesamiento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_sesion FOREIGN KEY (id_sesion) 
        REFERENCES sesion_evaluacion(id_sesion) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dictamen_sesion 
    ON dictamen_sesion(id_sesion);
CREATE INDEX IF NOT EXISTS idx_dictamen_usuario 
    ON dictamen_sesion(id_usuario);
CREATE INDEX IF NOT EXISTS idx_dictamen_clasificacion 
    ON dictamen_sesion(clasificacion);
"""

INSERT_SQL = """
INSERT INTO dictamen_sesion 
    (id_sesion, id_usuario, indice_confiabilidad, clasificacion, url_azure_json, resumen)
VALUES 
    (%s, %s, %s, %s, %s, %s)
RETURNING id_dictamen;
"""


def inicializar_tabla():
    """Crea la tabla dictamen_sesion si no existe."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(CREATE_TABLE_SQL)
        conn.close()
        logger.info("Tabla dictamen_sesion verificada/creada.")
    except Exception as e:
        logger.error(f"Error inicializando tabla: {e}")
        raise


def guardar_veredicto(
    sesion_id: int,
    user_id: int,
    indice_confiabilidad: float,
    clasificacion: str,
    url_azure: str,
    resumen: dict,
) -> int | None:
    """
    Guarda el veredicto final en PostgreSQL.

    Args:
        sesion_id: ID de la sesión de evaluación.
        user_id: ID del usuario evaluado.
        indice_confiabilidad: Porcentaje de confiabilidad (0.0 - 1.0).
        clasificacion: CONFIABLE | SOSPECHOSO | IRREGULAR.
        url_azure: URL del JSON completo en Azure Blob Storage.
        resumen: Dict con el resumen del veredicto (se guarda como JSONB).

    Returns:
        id_dictamen generado, o None si hubo error.
    """
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            cur.execute(
                INSERT_SQL,
                (
                    sesion_id,
                    user_id,
                    indice_confiabilidad,
                    clasificacion,
                    url_azure,
                    json.dumps(resumen, ensure_ascii=False),
                ),
            )
            id_dictamen = cur.fetchone()[0]
        conn.commit()
        conn.close()

        logger.info(
            f"Veredicto guardado en PostgreSQL: id_dictamen={id_dictamen}, "
            f"sesion={sesion_id}, clasificacion={clasificacion}"
        )
        return id_dictamen

    except Exception as e:
        logger.error(f"Error guardando veredicto en PostgreSQL: {e}")
        return None
