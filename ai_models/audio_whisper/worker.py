"""
worker.py — Lógica de Negocio del Worker de Audio (Faster-Whisper + NLP)
=========================================================================
Responsabilidad: descarga de audio, detección de silencio, transcripción,
análisis semántico, generación de soft evidence.
NO conoce RabbitMQ ni colas — eso es trabajo de main.py.
"""

import logging
from datetime import datetime, timezone

import audiocleaner as audio_cleaner
import transcriber
from analyzer_semantic import analyzer_service
from soft_evidence import normalizar_audio
import requests

logger = logging.getLogger("AudioWorker")


def descargar_audio_bytes(url: str) -> bytes | None:
    """Descarga el chunk de audio desde Azure Blob Storage."""
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        return response.content
    except Exception as e:
        logger.error(f"Error descargando audio de {url}: {e}")
        return None


def procesar_audio(user_id: str, sesion_id: str, url_storage: str) -> dict | None:
    """
    Pipeline completo de audio: descarga → silencio/voz → STT → NLP → soft evidence.

    Args:
        user_id:     ID del usuario (estudiante).
        sesion_id:   ID de la sesión de examen.
        url_storage: URL del chunk de audio en Azure Blob Storage.

    Returns:
        dict con el evento universal de soft evidence listo para encolar,
        o None si el audio no se pudo procesar.
    """
    # 1. Descargar el audio
    audio_bytes = descargar_audio_bytes(url_storage)
    if audio_bytes is None:
        return None

    # 2. Convertir a numpy
    audio_np = audio_cleaner.convertir_a_numpy(audio_bytes)
    if audio_np is None:
        logger.warning("Error convirtiendo bytes a numpy.")
        return None

    # 3. Detectar silencio (umbral: -45dB RMS)
    silencio = audio_cleaner.es_silencio(audio_np, umbral_db=-45)

    if silencio:
        # ── Caso Silencio ───────────────────────────────────────────
        # En Soft Evidence, el silencio NO es un early-return silencioso.
        # Generamos su distribución para que la Red Bayesiana lo observe.
        distribucion = normalizar_audio(es_silencio=True)
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "sesion_id": sesion_id,
            "source": "audio_nlp",
            "evidence_type": "soft",
            "soft_evidence": distribucion,
            "details": {
                "transcript": None,
                "silence_detected": True,
            }
        }

    # ── Caso Voz Detectada ──────────────────────────────────────────
    # Filtrar frecuencias de voz humana
    audio_filtrado = audio_cleaner.aplicar_filtro_voz(audio_np)

    # 4. Transcripción (STT con Faster-Whisper)
    texto = transcriber.transcribir_audio(audio_filtrado)

    if not texto or len(texto.strip()) < 2:
        # Ruido de fondo que parece voz: distribución neutral
        distribucion = normalizar_audio(
            es_silencio=False,
            score_trampa=0.0,
            score_domestico=0.0,
        )
    else:
        # 5. Análisis Semántico de NLP
        analisis = analyzer_service.analizar(texto)

        # 6. Softmax con temperatura sobre las similitudes coseno crudas
        distribucion = normalizar_audio(
            es_silencio=False,
            score_trampa=analisis["raw_score_trampa"],
            score_domestico=analisis["raw_score_domestico"],
            temperatura=1.5,
        )

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "sesion_id": sesion_id,
        "source": "audio_nlp",
        "evidence_type": "soft",
        "soft_evidence": distribucion,
        "details": {
            "transcript": texto if texto else None,
            "silence_detected": False,
        }
    }
