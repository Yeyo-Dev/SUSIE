"""
dictamen.py — Generador de dictamen y empaquetado JSON
=======================================================
Procesa las ventanas temporales evaluadas y genera:
  1. Timeline completo con P(fraude) por ventana
  2. Momentos sospechosos (solo los relevantes)
  3. Estadísticas generales
  4. Veredicto final con índice de confiabilidad
  5. JSON empaquetado listo para subir a Azure Blob Storage
"""

import logging
from datetime import datetime, timezone

from bayesian_network import inferir, obtener_factores
from config import (
    MUERTE_SUBITA_THRESHOLD,
    SOSPECHOSO_THRESHOLD,
    UMBRAL_CONFIABLE,
    UMBRAL_SOSPECHOSO,
)

logger = logging.getLogger("InferenceEngine.Dictamen")


def evaluar_ventanas(ventanas: list[dict]) -> list[dict]:
    """
    Ejecuta la inferencia bayesiana sobre cada ventana temporal.

    Agrega a cada ventana:
      - probabilidad_fraude: float
      - factores: list[str]
    """
    for ventana in ventanas:
        s = ventana["sensores"]
        prob = inferir(s["vision"], s["audio"], s["gaze"], s["eventos"])
        ventana["probabilidad_fraude"] = prob
        ventana["factores"] = obtener_factores(
            s["vision"], s["audio"], s["gaze"], s["eventos"]
        )

    return ventanas


def _extraer_momentos_sospechosos(ventanas: list[dict]) -> list[dict]:
    """Extrae solo las ventanas con probabilidad de fraude >= umbral."""
    momentos = []
    for v in ventanas:
        if v["probabilidad_fraude"] >= SOSPECHOSO_THRESHOLD:
            # Extraer solo las evidencias relevantes (no todas las raw)
            evidencias_filtradas = []
            for ev in v.get("evidencias_raw", []):
                source = ev.get("source", "unknown")
                if source == "browser_event" or ev.get("soft_evidence"):
                    evidencias_filtradas.append({
                        "source": source,
                        "timestamp": ev.get("timestamp"),
                        "soft_evidence": ev.get("soft_evidence"),
                        "trigger": ev.get("trigger"),
                        "details": ev.get("details", {}),
                    })

            momentos.append({
                "timestamp": v["timestamp_inicio"],
                "probabilidad_fraude": v["probabilidad_fraude"],
                "sensores": v["sensores"],
                "factores": v["factores"],
                "evidencias": evidencias_filtradas,
            })

    return momentos


def _calcular_estadisticas(ventanas: list[dict], logs_raw: list[dict]) -> dict:
    """Calcula estadísticas generales de la sesión."""
    if not ventanas:
        return {
            "total_ventanas": 0,
            "ventanas_limpias": 0,
            "ventanas_sospechosas": 0,
            "promedio_confiabilidad": 1.0,
            "pico_maximo_fraude": 0.0,
            "eventos_navegador": {},
        }

    probs = [v["probabilidad_fraude"] for v in ventanas]

    # Contar eventos de navegador por tipo
    conteo_browser = {}
    for ev in logs_raw:
        if ev.get("source") == "browser_event":
            trigger = ev.get("trigger", "unknown")
            conteo_browser[trigger] = conteo_browser.get(trigger, 0) + 1

    ventanas_sosp = sum(1 for p in probs if p >= SOSPECHOSO_THRESHOLD)

    return {
        "total_ventanas": len(ventanas),
        "ventanas_limpias": len(ventanas) - ventanas_sosp,
        "ventanas_sospechosas": ventanas_sosp,
        "promedio_confiabilidad": round(1.0 - (sum(probs) / len(probs)), 4),
        "pico_maximo_fraude": round(max(probs), 4),
        "eventos_navegador": conteo_browser,
    }


def _detectar_muerte_subita(ventanas: list[dict]) -> bool:
    """Detecta si alguna ventana supera el umbral de muerte súbita."""
    return any(v["probabilidad_fraude"] >= MUERTE_SUBITA_THRESHOLD for v in ventanas)


def _clasificar(indice_trampa: float, muerte_subita: bool) -> str:
    """Clasifica el resultado final del examen."""
    if muerte_subita:
        return "IRREGULAR"
    if indice_trampa >= UMBRAL_SOSPECHOSO:
        return "IRREGULAR"
    if indice_trampa >= UMBRAL_CONFIABLE:
        return "SOSPECHOSO"
    return "CONFIABLE"


def generar_dictamen(
    sesion_id: int | str,
    user_id: int | str,
    ventanas: list[dict],
    logs_raw: list[dict],
) -> dict:
    """
    Genera el dictamen completo empaquetado como JSON.

    Este JSON es el que se sube a Azure Blob Storage.
    Contiene todo lo necesario para la auditoría posterior.

    Returns:
        Dict con la estructura completa del dictamen.
    """
    # 1. Evaluar cada ventana con la red bayesiana
    ventanas_evaluadas = evaluar_ventanas(ventanas)

    # 2. Extraer momentos sospechosos
    momentos = _extraer_momentos_sospechosos(ventanas_evaluadas)

    # 3. Estadísticas
    stats = _calcular_estadisticas(ventanas_evaluadas, logs_raw)

    # 4. Muerte súbita
    muerte_subita = _detectar_muerte_subita(ventanas_evaluadas)

    # 5. Índices
    indice_trampa = round(1.0 - stats["promedio_confiabilidad"], 4)
    indice_confiabilidad = stats["promedio_confiabilidad"]

    # 6. Clasificación
    clasificacion = _clasificar(indice_trampa, muerte_subita)

    # 7. Factores principales (los más frecuentes en momentos sospechosos)
    todos_factores = []
    for m in momentos:
        todos_factores.extend(m.get("factores", []))
    factores_unicos = list(dict.fromkeys(todos_factores))  # Preserva orden, elimina duplicados

    # 8. Timeline limpio (sin evidencias_raw para reducir tamaño)
    timeline = []
    for v in ventanas_evaluadas:
        timeline.append({
            "timestamp": v["timestamp_inicio"],
            "ventana_segundos": v.get("epoch_fin", v["epoch_inicio"]) - v["epoch_inicio"]
            if "epoch_fin" in v
            else 30,
            "probabilidad_fraude": v["probabilidad_fraude"],
            "sensores": v["sensores"],
        })

    dictamen = {
        "version": "1.0.0",
        "generado_en": datetime.now(timezone.utc).isoformat(),
        "metadata_examen": {
            "sesion_id": sesion_id,
            "user_id": user_id,
            "total_eventos_procesados": len(logs_raw),
            "total_ventanas_analizadas": len(ventanas_evaluadas),
        },
        "veredicto": {
            "indice_confiabilidad": indice_confiabilidad,
            "indice_trampa": indice_trampa,
            "clasificacion": clasificacion,
            "muerte_subita": muerte_subita,
            "factores_principales": factores_unicos[:10],  # Top 10
        },
        "timeline": timeline,
        "momentos_sospechosos": momentos,
        "estadisticas": stats,
    }

    logger.info(
        f"Dictamen generado: sesion={sesion_id}, "
        f"clasificacion={clasificacion}, "
        f"confiabilidad={indice_confiabilidad}, "
        f"ventanas_sospechosas={stats['ventanas_sospechosas']}/{stats['total_ventanas']}"
    )

    return dictamen


def extraer_resumen_para_bd(dictamen: dict) -> dict:
    """
    Extrae solo el resumen necesario para guardar en PostgreSQL.
    El JSON completo va a Azure, en la BD solo guardamos lo mínimo.
    """
    return {
        "indice_confiabilidad": dictamen["veredicto"]["indice_confiabilidad"],
        "clasificacion": dictamen["veredicto"]["clasificacion"],
        "muerte_subita": dictamen["veredicto"]["muerte_subita"],
        "factores_principales": dictamen["veredicto"]["factores_principales"],
        "total_ventanas": dictamen["estadisticas"]["total_ventanas"],
        "ventanas_sospechosas": dictamen["estadisticas"]["ventanas_sospechosas"],
        "pico_maximo_fraude": dictamen["estadisticas"]["pico_maximo_fraude"],
    }
