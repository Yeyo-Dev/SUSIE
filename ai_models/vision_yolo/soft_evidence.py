"""
soft_evidence.py — Worker de Visión (YOLOv8 Nano)
==================================================
Genera una distribución de probabilidad normalizada sobre los estados
del nodo "Visión" de la Red Bayesiana.

Estados:  Normal | Ausente | Objeto_Prohibido | Multitud

Transformación matemática:
  1. Se asignan pesos crudos según las señales del modelo YOLO.
  2. Se aplica normalización L1: P(i) = w_i / Σ w_j
     Esto garantiza que Σ P(i) = 1.0  ∀ entrada.
"""


def normalizar_vision(person_count: int,
                      phone_confidence: float,
                      phone_detected: bool,
                      multi_person: bool) -> dict:
    """
    Convierte las detecciones crudas de YOLOv8 en una distribución
    de probabilidad sobre los 4 estados del nodo Visión.

    Args:
        person_count:     Número de personas detectadas en el frame.
        phone_confidence: Confianza máxima de detección de celular (0.0–1.0).
        phone_detected:   True si al menos un celular fue detectado.
        multi_person:     True si person_count > 1.

    Returns:
        dict con exactamente 4 claves y valores que suman 1.0.
        Ejemplo: {"Normal": 0.10, "Ausente": 0.05, "Objeto_Prohibido": 0.80, "Multitud": 0.05}
    """

    # ── Épsilon de suavizado ────────────────────────────────────────
    # Evita probabilidades exactamente 0.0, lo cual es deseable
    # en la Red Bayesiana (regla de Cromwell: nunca asignar P = 0).
    EPS = 0.02

    # ── Pesos crudos (antes de normalizar) ──────────────────────────
    w_normal = EPS
    w_ausente = EPS
    w_prohibido = EPS
    w_multitud = EPS

    # --- Caso 1: Nadie en el frame → Ausente domina ----------------
    # Si person_count == 0, asignamos 0.85 a Ausente.
    # El 0.15 restante se reparte como ruido entre los demás estados.
    if person_count == 0:
        w_ausente = 0.85
        w_normal = 0.05
        w_prohibido = 0.05
        w_multitud = 0.05

    # --- Caso 2: Celular detectado → Objeto_Prohibido domina -------
    # Usamos directamente el valor de confidence del modelo YOLO.
    # Ej: confidence = 0.75 → P(Objeto_Prohibido) ≈ 0.75
    #     El remanente (0.25) se reparte entre los otros estados.
    elif phone_detected and phone_confidence > 0.0:
        w_prohibido = max(phone_confidence, EPS)
        remanente = 1.0 - w_prohibido
        # Distribución del remanente: 60% Normal, 20% Ausente, 20% Multitud
        w_normal = remanente * 0.60
        w_ausente = remanente * 0.20
        w_multitud = remanente * 0.20

    # --- Caso 3: Múltiples personas → Multitud domina --------------
    # El peso crece con el número de personas extras: min(0.90, 0.5 + 0.15*extra)
    elif multi_person:
        extra = person_count - 1  # personas adicionales al estudiante
        w_multitud = min(0.90, 0.50 + 0.15 * extra)
        remanente = 1.0 - w_multitud
        w_normal = remanente * 0.60
        w_ausente = remanente * 0.10
        w_prohibido = remanente * 0.30

    # --- Caso 4: Todo normal (1 persona, sin objetos) ---------------
    else:
        w_normal = 0.85
        w_ausente = 0.05
        w_prohibido = 0.05
        w_multitud = 0.05

    # ── Normalización L1 ────────────────────────────────────────────
    # P(i) = w_i / Σ w_j   →   garantiza Σ P(i) = 1.0
    total = w_normal + w_ausente + w_prohibido + w_multitud

    distribucion = {
        "Normal":           round(w_normal / total, 4),
        "Ausente":          round(w_ausente / total, 4),
        "Objeto_Prohibido": round(w_prohibido / total, 4),
        "Multitud":         round(w_multitud / total, 4),
    }

    # ── Corrección de redondeo ──────────────────────────────────────
    # El round() puede causar que la suma difiera de 1.0 por ±0.0001.
    # Ajustamos el valor más grande para forzar Σ = 1.0 exacto.
    diff = 1.0 - sum(distribucion.values())
    if diff != 0.0:
        clave_max = max(distribucion, key=distribucion.get)
        distribucion[clave_max] = round(distribucion[clave_max] + diff, 4)

    return distribucion
