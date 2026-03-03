"""
soft_evidence.py — Worker de Audio (Faster-Whisper + SentenceTransformers)
==========================================================================
Genera una distribución de probabilidad normalizada sobre los estados
del nodo "Audio" de la Red Bayesiana.

Estados:  Silencio | Neutral | Domestico | Sospechoso

Transformación matemática:
  • Caso silencio: distribución casi-degenerada  P(Silencio) ≈ 0.97
  • Caso voz detectada: Softmax con Temperature Scaling sobre los
    scores de similitud coseno crudos.

  Softmax:  P(i) = exp(s_i / T) / Σ exp(s_j / T)

  Donde:
    s_i = score de similitud coseno para la categoría i
    T   = temperatura (hiperparámetro)
        T > 1 → distribución más uniforme (más incertidumbre)
        T < 1 → distribución más puntiaguda (más confianza)
        T = 1 → softmax estándar
"""

import numpy as np


def _softmax_con_temperatura(scores: list[float], temperatura: float = 1.0) -> list[float]:
    """
    Aplica Softmax con Temperature Scaling a un vector de scores.

    Softmax(s_i) = exp(s_i / T) / Σ_j exp(s_j / T)

    Se resta el máximo antes de exponenciar para evitar overflow numérico
    (truco log-sum-exp, estándar en implementaciones de softmax):
      exp((s_i - max(s)) / T) / Σ exp((s_j - max(s)) / T)
    Esto NO cambia el resultado matemático pero previene NaN/Inf.

    Args:
        scores:      Lista de scores crudos (ej. similitudes coseno).
        temperatura: Factor de escalado. T=1.0 es softmax estándar.

    Returns:
        Lista de probabilidades normalizadas (suman 1.0).
    """
    s = np.array(scores, dtype=np.float64)
    # Truco de estabilidad numérica: restar el máximo
    s_scaled = (s - np.max(s)) / temperatura
    exp_s = np.exp(s_scaled)
    probs = exp_s / np.sum(exp_s)
    return probs.tolist()


def normalizar_audio(es_silencio: bool,
                     score_trampa: float = 0.0,
                     score_domestico: float = 0.0,
                     temperatura: float = 1.5) -> dict:
    """
    Convierte las señales de audio (RMS, similitud coseno) en una
    distribución de probabilidad sobre los 4 estados del nodo Audio.

    Args:
        es_silencio:     True si el volumen RMS < -45dB.
        score_trampa:    Similitud coseno máxima vs embeddings de trampa.
        score_domestico: Similitud coseno máxima vs embeddings domésticos.
        temperatura:     Parámetro T del Softmax. Default 1.5 para suavizar
                         la distribución y reflejar la incertidumbre inherente
                         del análisis semántico.

    Returns:
        dict con exactamente 4 claves y valores que suman 1.0.
        Ejemplo: {"Silencio": 0.02, "Neutral": 0.15, "Domestico": 0.60, "Sospechoso": 0.23}
    """

    # ── Caso 1: Silencio ────────────────────────────────────────────
    # Si el volumen RMS es < -45dB, no hay información acústica útil.
    # Asignamos casi toda la masa a Silencio.
    if es_silencio:
        return {
            "Silencio":    0.97,
            "Neutral":     0.01,
            "Domestico":   0.01,
            "Sospechoso":  0.01,
        }

    # ── Caso 2: Voz detectada ──────────────────────────────────────
    # Construimos un vector de 4 scores sobre el cual aplicaremos Softmax.
    #
    # Scores crudos:
    #   Silencio    → -1.0 (penalización fuerte: sabemos que HAY voz)
    #   Neutral     →  0.0 (prior base: si la voz no se parece a nada)
    #   Domestico   →  score de similitud coseno vs frases domésticas
    #   Sospechoso  →  score de similitud coseno vs frases de trampa
    #
    # La similitud coseno ya está en rango [-1, 1], y frecuentemente
    # en [0, 0.8] para nuestro modelo MiniLM. El Softmax los convierte
    # en probabilidades respetando sus magnitudes relativas.

    scores = [
        -1.0,              # Silencio (penalizado)
        0.0,               # Neutral (línea base)
        score_domestico,   # Doméstico (similitud cruda)
        score_trampa,      # Sospechoso (similitud cruda)
    ]

    probs = _softmax_con_temperatura(scores, temperatura)

    distribucion = {
        "Silencio":    round(probs[0], 4),
        "Neutral":     round(probs[1], 4),
        "Domestico":   round(probs[2], 4),
        "Sospechoso":  round(probs[3], 4),
    }

    # ── Corrección de redondeo → forzar Σ = 1.0 exacto ─────────────
    diff = 1.0 - sum(distribucion.values())
    if diff != 0.0:
        clave_max = max(distribucion, key=distribucion.get)
        distribucion[clave_max] = round(distribucion[clave_max] + diff, 4)

    return distribucion
