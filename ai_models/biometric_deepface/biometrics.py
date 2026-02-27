import face_recognition
import cv2
import numpy as np

def clean_image_aggressively(image):
    """Limpia la imagen para evitar errores de dlib/numpy"""
    if image is None: return None
    
    # Forzar uint8
    if image.dtype != np.uint8:
        image = image.astype('uint8')

    # Manejo de canales
    if len(image.shape) == 2: # Grises
        rgb = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    elif image.shape[2] == 4: # BGRA
        rgb = cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
    else: # BGR (Estándar OpenCV)
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # CRÍTICO: Memoria contigua
    return np.ascontiguousarray(rgb)

def process_image_bytes(file_bytes):
    """Bytes -> Imagen Numpy Limpia"""
    nparr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return clean_image_aggressively(img)

def generar_vector(image_np):
    """Imagen -> Vector de 128 floats"""
    try:
        # 'hog' es rápido y ligero para CPU
        boxes = face_recognition.face_locations(image_np, model="hog")
        if not boxes: return None

        encodings = face_recognition.face_encodings(image_np, boxes)
        if not encodings: return None
        
        return encodings[0]
    except Exception as e:
        print(f"Error procesando vector: {e}")
        return None

def comparar_vectores(vector_db, vector_nuevo, umbral=0.5):
    """Compara dos vectores. Retorna (bool, float)"""
    distancia = face_recognition.face_distance([vector_db], vector_nuevo)[0]
    match = bool(distancia < umbral)
    return match, distancia