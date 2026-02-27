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
    Retorna el estado de atención del estudiante.
    """
    if len(buffer) < 15:
        return {"status": "insufficient_data", "reason": "Se necesitan más frames"}

    # 1. Limpieza de ruido (micromovimientos falsos)
    clean_data = detect_saccade_noise(buffer)
    if len(clean_data) < 15:
         return {"status": "too_much_noise", "reason": "Datos descartados por exceso de saltos irreales"}

    # 2. Heurística: Tiempo fuera del monitor. Tolerancia a vistazos (Out of Bounds Continuo vs Acumulado)
    out_of_bounds_flags = [is_out_of_bounds(x, y) for x, y in clean_data]
    
    # Calculamos la "racha" más larga de frames fuera de la pantalla
    max_consecutive_oob = 0
    current_oob = 0
    for is_oob in out_of_bounds_flags:
        if is_oob:
            current_oob += 1
            max_consecutive_oob = max(max_consecutive_oob, current_oob)
        else:
            current_oob = 0
            
    total_oob_ratio = sum(out_of_bounds_flags) / len(clean_data)

    # REGLAS DE NEGOCIO PARA LÍMITES:
    # Asumiendo ~10 frames por segundo: 15 frames = 1.5 segundos continuos.
    if max_consecutive_oob > 15:
        return {"status": "alert", "reason": "prolonged_look_away", "details": "Mirada fuera del monitor por tiempo continuo prolongado (> 1.5s)"}
    elif total_oob_ratio > 0.4:
        return {"status": "alert", "reason": "frequent_look_away", "details": "Demasiados vistazos repetitivos fuera del monitor"}

    X = np.array(clean_data)

    # 3. DBSCAN: Detección de "islas" de atención (Ej. Acordeón fijo en el escritorio)
    dbscan = DBSCAN(eps=0.3, min_samples=5)
    labels = dbscan.fit_predict(X)
    valid_clusters = set(labels) - {-1} 
    
    if len(valid_clusters) >= 2:
        # Contamos cuántos frames (cuánto tiempo) pasó el usuario en cada clúster
        cluster_counts = {c: list(labels).count(c) for c in valid_clusters}
        
        # Ordenamos los clústeres por tamaño (de mayor a menor)
        # El más grande asumimos que es el texto principal del examen
        sorted_sizes = sorted(cluster_counts.values(), reverse=True)
        
        # Analizamos el SEGUNDO clúster más grande
        second_cluster_size = sorted_sizes[1]
        total_valid_frames = len(X)
        
        # Si el segundo foco de atención acapara más del 20% del tiempo analizado...
        if (second_cluster_size / total_valid_frames) > 0.20:
            return {
                "status": "alert", 
                "reason": "sustained_secondary_attention", 
                "details": "Lectura prolongada en área secundaria. No es un simple vistazo a la interfaz."
            }
        else:
            # Si hay un segundo clúster pero es pequeñito, lo perdonamos (Botón UI)
            pass

    # 4. Isolation Forest: Comportamiento errático (Nerviosismo, buscando alrededor)
    iso_forest = IsolationForest(contamination=0.2, random_state=42)
    anomalies = iso_forest.fit_predict(X)
    
    outliers_ratio = list(anomalies).count(-1) / len(anomalies)
    if outliers_ratio > 0.25:
        return {
            "status": "alert", 
            "reason": "erratic_behavior", 
            "details": f"Mirada inestable. {round(outliers_ratio * 100)}% de los movimientos son anómalos"
        }

    # Todo en orden
    return {"status": "normal", "reason": "focused", "details": "El estudiante mantiene la atención"}