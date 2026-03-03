import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.ensemble import IsolationForest

def is_out_of_bounds(x, y, limit=1.0):
    """Verifica si una coordenada individual está fuera de la pantalla."""
    return abs(x) > limit or abs(y) > limit

def detect_saccade_noise(coords, max_distance=0.5):
    """Filtra saltos irreales (parpadeos o fallos del tracker en milisegundos)."""
    if not coords: return []
    
    clean_coords = [coords[0]]
    for i in range(1, len(coords)):
        x1, y1 = coords[i-1]
        x2, y2 = coords[i]
        
        # Distancia euclidiana
        dist = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
        if dist <= max_distance:
            clean_coords.append(coords[i])
            
    return clean_coords

def analyze_gaze_buffer(buffer):
    """
    Función principal. Recibe una lista de tuplas [(x1,y1), (x2,y2)...]
    Retorna un diccionario con métricas crudas de las 3 señales del pipeline,
    listas para ser consumidas por el módulo de Soft Evidence.

    Returns:
        dict con:
          - status: "ok", "insufficient_data", "too_much_noise"
          - oob_ratio: fracción de frames fuera de pantalla [0, 1]
          - secondary_cluster_ratio: fracción del 2do clúster DBSCAN [0, 1]
          - anomaly_ratio: fracción de anomalías Isolation Forest [0, 1]
    """
    if len(buffer) < 15:
        return {
            "status": "insufficient_data",
            "oob_ratio": 0.0,
            "secondary_cluster_ratio": 0.0,
            "anomaly_ratio": 0.0,
        }

    # 1. Limpieza de ruido (micromovimientos falsos)
    clean_data = detect_saccade_noise(buffer)
    if len(clean_data) < 15:
        return {
            "status": "too_much_noise",
            "oob_ratio": 0.0,
            "secondary_cluster_ratio": 0.0,
            "anomaly_ratio": 0.0,
        }

    # ── Sub-pipeline 1: Heurística OOB (Out of Bounds) ──────────────
    out_of_bounds_flags = [is_out_of_bounds(x, y) for x, y in clean_data]
    total_oob_ratio = sum(out_of_bounds_flags) / len(clean_data)

    # ── Sub-pipeline 2: DBSCAN — Clústeres de atención ─────────────
    X = np.array(clean_data)
    secondary_cluster_ratio = 0.0

    dbscan = DBSCAN(eps=0.3, min_samples=5)
    labels = dbscan.fit_predict(X)
    valid_clusters = set(labels) - {-1}

    if len(valid_clusters) >= 2:
        cluster_counts = {c: list(labels).count(c) for c in valid_clusters}
        sorted_sizes = sorted(cluster_counts.values(), reverse=True)
        second_cluster_size = sorted_sizes[1]
        total_valid_frames = len(X)
        secondary_cluster_ratio = second_cluster_size / total_valid_frames

    # ── Sub-pipeline 3: Isolation Forest — Anomalías ────────────────
    iso_forest = IsolationForest(contamination=0.2, random_state=42)
    anomalies = iso_forest.fit_predict(X)
    anomaly_ratio = list(anomalies).count(-1) / len(anomalies)

    return {
        "status": "ok",
        "oob_ratio": round(total_oob_ratio, 4),
        "secondary_cluster_ratio": round(secondary_cluster_ratio, 4),
        "anomaly_ratio": round(anomaly_ratio, 4),
    }