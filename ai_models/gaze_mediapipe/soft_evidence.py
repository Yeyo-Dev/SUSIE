"""
soft_evidence.py — Worker de Gaze Tracking (DBSCAN + Isolation Forest)
=======================================================================
Genera una distribución de probabilidad normalizada sobre los estados
del nodo "Mirada" de la Red Bayesiana.

Estados:  Concentrado | Fuera_de_Pantalla | Atencion_Secundaria | Erratico

Transformación matemática:
  Dado que el pipeline de gaze combina tres algoritmos heterogéneos
  (heurísticas OOB, DBSCAN, Isolation Forest), no podemos aplicar
  Softmax directamente. En su lugar usamos un sistema de pesos relativos
  con normalización L1.

  1. Cada señal del pipeline (oob_ratio, cluster_ratio, anomaly_ratio)
     se convierte en un peso crudo para su estado correspondiente.
  2. El estado "Concentrado" actúa como complemento:
       w_concentrado = max(ε, 1 - Σ w_otros)
  3. Normalización L1:
       P(i) = w_i / Σ w_j
     Esto garantiza Σ P(i) = 1.0
"""


def normalizar_gaze(oob_ratio: float,
                    secondary_cluster_ratio: float,
                    anomaly_ratio: float) -> dict:
    """
    Convierte las métricas crudas del pipeline de gaze en una
    distribución de probabilidad sobre los 4 estados del nodo Mirada.

    Args:
        oob_ratio:               Fracción de frames fuera de pantalla [0, 1].
                                 Calculado como total_oob / total_frames.
        secondary_cluster_ratio: Fracción de frames en el 2do clúster DBSCAN [0, 1].
                                 Calculado como size_2nd_cluster / total_valid_frames.
                                 0.0 si solo hay un clúster o datos insuficientes.
        anomaly_ratio:           Fracción de anomalías detectadas por Isolation Forest [0, 1].
                                 Calculado como outliers / total_frames.

    Returns:
        dict con exactamente 4 claves y valores que suman 1.0.
        Ejemplo: {"Concentrado": 0.65, "Fuera_de_Pantalla": 0.15,
                  "Atencion_Secundaria": 0.10, "Erratico": 0.10}
    """

    # ── Épsilon mínimo (Regla de Cromwell) ──────────────────────────
    # Ningún estado puede tener peso 0.0 absoluto.
    EPS = 0.02

    # ── Clamp: asegurar que los ratios estén en [0, 1] ──────────────
    # Protección contra valores fuera de rango por bugs upstream.
    oob_ratio = max(0.0, min(1.0, oob_ratio))
    secondary_cluster_ratio = max(0.0, min(1.0, secondary_cluster_ratio))
    anomaly_ratio = max(0.0, min(1.0, anomaly_ratio))

    # ── Pesos crudos derivados de las señales del pipeline ──────────
    #
    # Fuera_de_Pantalla:     directamente proporcional al % de OOB.
    # Atencion_Secundaria:   directamente proporcional al tamaño del
    #                        segundo clúster DBSCAN vs total de frames.
    # Erratico:              directamente proporcional al % de anomalías
    #                        reportadas por Isolation Forest.
    # Concentrado:           inversamente proporcional a la suma de
    #                        los otros tres (complemento).

    w_fuera = max(EPS, oob_ratio)
    w_secundaria = max(EPS, secondary_cluster_ratio)
    w_erratico = max(EPS, anomaly_ratio)

    # El peso de "Concentrado" es el complemento de las señales de alerta.
    # Si todos los ratios son bajos, Concentrado domina.
    # Si los ratios suman > 1.0, Concentrado recibe solo el épsilon mínimo.
    suma_alertas = w_fuera + w_secundaria + w_erratico
    w_concentrado = max(EPS, 1.0 - suma_alertas)

    # ── Normalización L1 ────────────────────────────────────────────
    # P(i) = w_i / Σ w_j
    # Divide cada peso entre la suma total → Σ P(i) = 1.0
    total = w_concentrado + w_fuera + w_secundaria + w_erratico

    distribucion = {
        "Concentrado":         round(w_concentrado / total, 4),
        "Fuera_de_Pantalla":   round(w_fuera / total, 4),
        "Atencion_Secundaria": round(w_secundaria / total, 4),
        "Erratico":            round(w_erratico / total, 4),
    }

    # ── Corrección de redondeo → forzar Σ = 1.0 exacto ─────────────
    diff = 1.0 - sum(distribucion.values())
    if diff != 0.0:
        clave_max = max(distribucion, key=distribucion.get)
        distribucion[clave_max] = round(distribucion[clave_max] + diff, 4)

    return distribucion
