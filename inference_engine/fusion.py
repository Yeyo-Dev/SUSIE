"""
fusion.py — Fusión temporal de evidencias multisensor
======================================================
Agrupa los eventos de diferentes fuentes (visión, audio, gaze, browser)
por ventanas temporales para crear "snapshots" multimodales.

Cada ventana representa un momento en el tiempo con el estado de
todos los sensores disponibles.
"""

import logging
from datetime import datetime, timezone
from config import FUSION_WINDOW_SECONDS

logger = logging.getLogger("InferenceEngine.Fusion")

# Estados por defecto cuando un sensor no tiene data en una ventana
DEFAULTS = {
    "yolo_vision": "Normal",
    "audio_nlp": "Silencio",
    "gaze_tracker": "Concentrado",
    "browser_event": "Normal",
}


def _parse_timestamp(ts) -> float:
    """Convierte un timestamp (ISO string o epoch) a epoch float."""
    if isinstance(ts, (int, float)):
        # Si es epoch en milisegundos, convertir a segundos
        if ts > 1e12:
            return ts / 1000.0
        return float(ts)
    if isinstance(ts, str):
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.timestamp()
        except ValueError:
            return 0.0
    return 0.0


def _extraer_estado_dominante(eventos_source: list[dict], source: str) -> str:
    """
    Dado un grupo de eventos del mismo source en una ventana,
    extrae el estado más probable (el de mayor valor en soft_evidence).
    Para browser_events, mapea el trigger a un nivel de severidad.
    """
    if not eventos_source:
        return DEFAULTS.get(source, "Normal")

    if source == "browser_event":
        return _clasificar_eventos_navegador(eventos_source)

    # Para workers IA: tomar el evento con soft_evidence más "anómala"
    peor_evento = None
    peor_nivel = -1.0

    for ev in eventos_source:
        se = ev.get("soft_evidence", {})
        estado_normal = DEFAULTS.get(source, "Normal")
        prob_normal = se.get(estado_normal, 1.0)
        nivel_anomalia = 1.0 - prob_normal

        if nivel_anomalia > peor_nivel:
            peor_nivel = nivel_anomalia
            peor_evento = ev

    if peor_evento and peor_evento.get("soft_evidence"):
        # Retornar el estado con mayor probabilidad
        se = peor_evento["soft_evidence"]
        return max(se, key=se.get) if se else DEFAULTS.get(source, "Normal")

    return DEFAULTS.get(source, "Normal")


def _clasificar_eventos_navegador(eventos: list[dict]) -> str:
    """
    Clasifica un conjunto de eventos del navegador en una ventana temporal
    al estado de severidad más alto encontrado.
    """
    SEVERIDAD = {
        "DEVTOOLS_OPENED": "Grave",
        "CLIPBOARD_ATTEMPT": "Grave",
        "TAB_SWITCH": "Moderado",
        "FULLSCREEN_EXIT": "Moderado",
        "NAVIGATION_ATTEMPT": "Moderado",
        "LOSS_FOCUS": "Leve",
        "RELOAD_ATTEMPT": "Leve",
    }
    ORDEN = {"Normal": 0, "Leve": 1, "Moderado": 2, "Grave": 3}

    max_sev = "Normal"
    for ev in eventos:
        trigger = ev.get("trigger", "")
        sev = SEVERIDAD.get(trigger, "Leve")
        if ORDEN.get(sev, 0) > ORDEN.get(max_sev, 0):
            max_sev = sev

    return max_sev


def agrupar_por_ventana(eventos: list[dict]) -> list[dict]:
    """
    Agrupa todos los eventos de una sesión en ventanas temporales.

    Cada ventana contiene el estado dominante de cada sensor
    y los detalles de los eventos dentro de esa ventana.

    Args:
        eventos: Lista de todos los eventos de la sesión (ya leídos de Redis).

    Returns:
        Lista de ventanas, cada una con:
        {
            "timestamp_inicio": ISO string,
            "timestamp_fin": ISO string,
            "epoch_inicio": float,
            "sensores": {"vision": "Normal", "audio": "Silencio", ...},
            "evidencias_raw": [lista de eventos en esta ventana],
            "conteo_por_source": {"yolo_vision": 3, "audio_nlp": 2, ...}
        }
    """
    if not eventos:
        return []

    # Ordenar por timestamp
    for ev in eventos:
        ev["_epoch"] = _parse_timestamp(ev.get("timestamp", 0))

    eventos_sorted = sorted(eventos, key=lambda e: e["_epoch"])

    # Crear ventanas
    ventanas = []
    ventana_inicio = eventos_sorted[0]["_epoch"]
    ventana_actual = []

    for ev in eventos_sorted:
        if ev["_epoch"] - ventana_inicio >= FUSION_WINDOW_SECONDS:
            # Cerrar ventana actual y empezar nueva
            if ventana_actual:
                ventanas.append(_construir_ventana(ventana_actual, ventana_inicio))
            ventana_inicio = ev["_epoch"]
            ventana_actual = [ev]
        else:
            ventana_actual.append(ev)

    # Última ventana
    if ventana_actual:
        ventanas.append(_construir_ventana(ventana_actual, ventana_inicio))

    logger.info(f"Agrupados {len(eventos)} eventos en {len(ventanas)} ventanas de {FUSION_WINDOW_SECONDS}s")
    return ventanas


def _construir_ventana(eventos: list[dict], epoch_inicio: float) -> dict:
    """Construye el dict de una ventana temporal a partir de sus eventos."""
    # Separar por source
    por_source: dict[str, list[dict]] = {}
    for ev in eventos:
        source = ev.get("source", "unknown")
        por_source.setdefault(source, []).append(ev)

    # Extraer estado dominante de cada sensor
    sensores = {
        "vision": _extraer_estado_dominante(
            por_source.get("yolo_vision", []), "yolo_vision"
        ),
        "audio": _extraer_estado_dominante(
            por_source.get("audio_nlp", []), "audio_nlp"
        ),
        "gaze": _extraer_estado_dominante(
            por_source.get("gaze_tracker", []), "gaze_tracker"
        ),
        "eventos": _extraer_estado_dominante(
            por_source.get("browser_event", []), "browser_event"
        ),
    }

    epoch_fin = max(ev["_epoch"] for ev in eventos)

    return {
        "timestamp_inicio": datetime.fromtimestamp(epoch_inicio, tz=timezone.utc).isoformat(),
        "timestamp_fin": datetime.fromtimestamp(epoch_fin, tz=timezone.utc).isoformat(),
        "epoch_inicio": epoch_inicio,
        "sensores": sensores,
        "evidencias_raw": eventos,
        "conteo_por_source": {s: len(evs) for s, evs in por_source.items()},
    }
