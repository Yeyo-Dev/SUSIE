"""
azure_uploader.py — Subida de JSON a Azure Blob Storage
=========================================================
Sube el JSON empaquetado del dictamen a Azure Blob Storage
y retorna la URL pública/SAS para almacenar en PostgreSQL.

Si Azure no está configurado, guarda en disco local como fallback
para desarrollo.
"""

import json
import os
import logging
from datetime import datetime, timezone

from config import AZURE_STORAGE_CONNECTION_STRING, AZURE_CONTAINER_NAME

logger = logging.getLogger("InferenceEngine.AzureUploader")


def subir_dictamen(dictamen: dict, sesion_id, user_id) -> str:
    """
    Sube el dictamen como JSON a Azure Blob Storage.

    Args:
        dictamen: Dict completo del dictamen.
        sesion_id: ID de la sesión.
        user_id: ID del usuario.

    Returns:
        URL del blob en Azure (o path local si Azure no está configurado).
    """
    fecha = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    blob_name = f"dictamen_{sesion_id}_{user_id}_{fecha}.json"
    json_content = json.dumps(dictamen, ensure_ascii=False, indent=2)

    # ── Azure Blob Storage ──────────────────────────────────
    if AZURE_STORAGE_CONNECTION_STRING:
        try:
            return _subir_a_azure(blob_name, json_content)
        except Exception as e:
            logger.error(f"Error subiendo a Azure: {e}. Usando fallback local.")
            return _guardar_local(blob_name, json_content)

    # ── Fallback: disco local (desarrollo) ──────────────────
    logger.warning("Azure no configurado. Guardando dictamen en disco local.")
    return _guardar_local(blob_name, json_content)


def _subir_a_azure(blob_name: str, content: str) -> str:
    """Sube el archivo a Azure Blob Storage usando el SDK oficial."""
    from azure.storage.blob import BlobServiceClient, ContentSettings

    blob_service = BlobServiceClient.from_connection_string(
        AZURE_STORAGE_CONNECTION_STRING
    )
    container_client = blob_service.get_container_client(AZURE_CONTAINER_NAME)

    # Crear el contenedor si no existe
    try:
        container_client.create_container()
        logger.info(f"Contenedor '{AZURE_CONTAINER_NAME}' creado.")
    except Exception:
        pass  # Ya existe

    blob_client = container_client.get_blob_client(blob_name)
    blob_client.upload_blob(
        content,
        overwrite=True,
        content_settings=ContentSettings(content_type="application/json"),
    )

    url = blob_client.url
    logger.info(f"Dictamen subido a Azure: {url}")
    return url


def _guardar_local(blob_name: str, content: str) -> str:
    """Fallback para desarrollo: guarda el JSON en disco local."""
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)

    filepath = os.path.join(output_dir, blob_name)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    logger.info(f"Dictamen guardado localmente: {filepath}")
    return f"file://{filepath}"
