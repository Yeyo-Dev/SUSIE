"""
bayesian_network.py — Red Bayesiana Naïve para detección de fraude
===================================================================
CPT de 256 combinaciones (4 nodos × 4 estados cada uno) usando
modelo paramétrico aditivo.

Nodos:
  V (Visión/YOLO):    Normal, Ausente, Objeto_Prohibido, Multitud
  A (Audio/Whisper):   Silencio, Neutral, Domestico, Sospechoso
  G (Gaze/MediaPipe):  Concentrado, Fuera_de_Pantalla, Atencion_Secundaria, Erratico
  E (Eventos/Browser): Normal, Leve, Moderado, Grave

Diseñado como scaffold: los pesos paramétricos son conservadores
y serán reemplazados por un modelo ML entrenado con datos reales.
"""

import logging

logger = logging.getLogger("InferenceEngine.BayesianNetwork")

# ── Pesos base por nodo (modelo paramétrico aditivo) ────────
# P(fraude) = clamp(P_base(V) + Δ_A + Δ_G + Δ_E, 0.01, 0.99)

P_BASE_VISION = {
    "Normal": 0.01,
    "Ausente": 0.30,
    "Objeto_Prohibido": 0.73,
    "Multitud": 0.85,
}

DELTA_AUDIO = {
    "Silencio": -0.05,
    "Neutral": -0.01,
    "Domestico": 0.02,
    "Sospechoso": 0.20,
}

DELTA_GAZE = {
    "Concentrado": -0.10,
    "Fuera_de_Pantalla": 0.05,
    "Atencion_Secundaria": 0.03,
    "Erratico": 0.07,
}

DELTA_EVENTOS = {
    "Normal": 0.00,
    "Leve": 0.03,
    "Moderado": 0.10,
    "Grave": 0.25,
}

# ── CPT pre-computada (256 entradas) ───────────────────────
# Se genera una sola vez al importar el módulo para lookup O(1)
CPT_TABLE: dict[tuple[str, str, str, str], float] = {}


def _generar_cpt():
    """Pre-computa las 256 combinaciones de la CPT."""
    for v, p_v in P_BASE_VISION.items():
        for a, d_a in DELTA_AUDIO.items():
            for g, d_g in DELTA_GAZE.items():
                for e, d_e in DELTA_EVENTOS.items():
                    prob = max(0.01, min(0.99, p_v + d_a + d_g + d_e))
                    CPT_TABLE[(v, a, g, e)] = round(prob, 4)


# Generar CPT al importar el módulo
_generar_cpt()


def inferir(vision: str, audio: str, gaze: str, eventos: str) -> float:
    """
    Calcula P(fraude | V, A, G, E) usando lookup en la CPT pre-computada.

    Args:
        vision:  Estado del nodo V (Normal, Ausente, Objeto_Prohibido, Multitud)
        audio:   Estado del nodo A (Silencio, Neutral, Domestico, Sospechoso)
        gaze:    Estado del nodo G (Concentrado, Fuera_de_Pantalla, Atencion_Secundaria, Erratico)
        eventos: Estado del nodo E (Normal, Leve, Moderado, Grave)

    Returns:
        float entre 0.01 y 0.99 representando P(fraude).
    """
    key = (vision, audio, gaze, eventos)

    if key in CPT_TABLE:
        return CPT_TABLE[key]

    # Fallback: si el estado no se reconoce, usar defaults conservadores
    logger.warning(f"Combinación no encontrada en CPT: {key}. Usando cálculo dinámico.")
    p_v = P_BASE_VISION.get(vision, 0.01)
    d_a = DELTA_AUDIO.get(audio, 0.0)
    d_g = DELTA_GAZE.get(gaze, 0.0)
    d_e = DELTA_EVENTOS.get(eventos, 0.0)
    return round(max(0.01, min(0.99, p_v + d_a + d_g + d_e)), 4)


def obtener_factores(vision: str, audio: str, gaze: str, eventos: str) -> list[str]:
    """
    Retorna una lista descriptiva de los factores que contribuyen
    a la probabilidad de fraude. Útil para el campo 'factores_principales'
    del dictamen.
    """
    factores = []

    if vision in ("Objeto_Prohibido", "Multitud", "Ausente"):
        factores.append(f"vision_{vision.lower()}")
    if audio == "Sospechoso":
        factores.append("audio_sospechoso")
    if gaze in ("Erratico", "Fuera_de_Pantalla"):
        factores.append(f"gaze_{gaze.lower()}")
    if eventos in ("Moderado", "Grave"):
        factores.append(f"evento_{eventos.lower()}")

    return factores


def validar_cpt():
    """
    Validación de sanidad de la CPT.
    Verifica que:
      1. Hay exactamente 256 entradas
      2. Todos los valores están entre 0.01 y 0.99
      3. Los extremos son coherentes (Normal+Silencio+Concentrado+Normal → bajo,
         Objeto_Prohibido+Sospechoso+Erratico+Grave → alto)
    """
    assert len(CPT_TABLE) == 256, f"CPT tiene {len(CPT_TABLE)} entradas, esperaba 256"

    for key, val in CPT_TABLE.items():
        assert 0.01 <= val <= 0.99, f"Valor fuera de rango para {key}: {val}"

    # Extremos esperados
    min_fraude = CPT_TABLE[("Normal", "Silencio", "Concentrado", "Normal")]
    max_fraude = CPT_TABLE[("Multitud", "Sospechoso", "Erratico", "Grave")]

    assert min_fraude == 0.01, f"Mínimo esperado 0.01, obtenido {min_fraude}"
    assert max_fraude == 0.99, f"Máximo esperado 0.99, obtenido {max_fraude}"

    logger.info(f"CPT validada: 256 entradas, rango [{min_fraude}, {max_fraude}]")
    return True
