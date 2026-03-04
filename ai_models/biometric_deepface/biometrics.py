"""
biometrics.py — Lógica de IA Biométrica (face_recognition / dlib)
==================================================================
Responsabilidad: procesamiento de imágenes, vectorización de rostros,
y comparación de embeddings. Stateless — no guarda nada.
"""

import cv2
import numpy as np
import requests
import face_recognition


def clean_image(image: np.ndarray) -> np.ndarray | None:
    """
    Limpia y normaliza una imagen para dlib/face_recognition.
    Convierte a RGB, fuerza uint8 y memoria contigua.
    """
    if image is None:
        return None

    if image.dtype != np.uint8:
        image = image.astype('uint8')

    if len(image.shape) == 2:
        rgb = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    elif image.shape[2] == 4:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
    else:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    return np.ascontiguousarray(rgb)


def descargar_imagen(url: str) -> np.ndarray | None:
    """
    Descarga una imagen desde una URL (Azure Blob Storage)
    y la decodifica a un array numpy BGR (OpenCV).
    """
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        nparr = np.frombuffer(response.content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return clean_image(img)
    except Exception as e:
        print(f"Error descargando imagen de {url}: {e}")
        return None


def generar_vector(image_np: np.ndarray) -> np.ndarray | None:
    """
    Genera un embedding facial de 128 dimensiones a partir de una
    imagen RGB. Usa el modelo HOG (rápido, CPU-friendly).

    Returns:
        np.ndarray de shape (128,) o None si no se detectó rostro.
    """
    try:
        boxes = face_recognition.face_locations(image_np, model="hog")
        if not boxes:
            return None

        encodings = face_recognition.face_encodings(image_np, boxes)
        if not encodings:
            return None

        return encodings[0]
    except Exception as e:
        print(f"Error generando vector: {e}")
        return None


def comparar_vectores(vector_db: list | np.ndarray,
                      vector_nuevo: np.ndarray,
                      umbral: float = 0.5) -> dict:
    """
    Compara dos embeddings faciales usando distancia euclidiana
    (implementación interna de face_recognition).

    La distancia está en el rango [0, ~1.2]:
      - 0.0 = idénticos
      - < 0.5 = misma persona (umbral por defecto)
      - > 0.6 = personas diferentes

    Convertimos a similitud porcentual:
      similarity = max(0, (1 - distancia)) * 100

    Args:
        vector_db:    Embedding almacenado en la BD (lista de 128 floats).
        vector_nuevo: Embedding recién calculado.
        umbral:       Distancia máxima para considerar match.

    Returns:
        dict con is_match, similarity_percent, y distance.
    """
    v_db = np.array(vector_db, dtype=np.float64)
    v_new = np.array(vector_nuevo, dtype=np.float64)

    distancia = face_recognition.face_distance([v_db], v_new)[0]
    es_match = bool(distancia < umbral)

    # Convertir distancia a porcentaje de similitud (intuitivo para el usuario)
    similarity = max(0.0, (1.0 - distancia)) * 100

    return {
        "is_match": es_match,
        "similarity_percent": round(similarity, 2),
        "distance": round(float(distancia), 4),
    }