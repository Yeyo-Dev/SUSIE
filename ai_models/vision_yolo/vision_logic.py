from ultralytics import YOLO
import cv2
import numpy as np

print("⏳ Cargando modelo YOLOv8 Nano...")
# Usamos el modelo nano (n) pre-entrenado. Se descarga solo la primera vez.
model = YOLO('yolov8n.pt')  
# Ajustamos confianza. 0.4 evita detectar "fantasmas" pero detecta celulares claros.
CONF_THRESHOLD = 0.45 
print("✅ Modelo YOLO cargado.")

# Mapeo de IDs de COCO que nos interesan
CLASS_PERSON = 0
CLASS_CELLPHONE = 67

def analizar_frame(image_np):
    """
    Recibe un array numpy de imagen (OpenCV format BGR)
    Retorna el análisis de objetos prohibidos/requeridos.
    """
    # Corremos la inferencia. verbose=False para no llenar los logs.
    results = model(image_np, conf=CONF_THRESHOLD, verbose=False)
    
    person_count = 0
    phone_count = 0
    detected_objects = []

    # Procesamos la primera imagen del lote (solo mandamos una)
    result = results[0]
    
    # Iteramos sobre las cajas detectadas
    for box in result.boxes:
        class_id = int(box.cls[0])
        class_name = model.names[class_id]
        
        if class_id == CLASS_PERSON:
            person_count += 1
            detected_objects.append("persona")
        elif class_id == CLASS_CELLPHONE:
            phone_count += 1
            detected_objects.append("celular")
            
    # --- LÓGICA DE NEGOCIO ---
    score = 0.0
    status = "FOCUSED"
    flags = []

    # Regla 1: Celulares (Tolerancia Cero)
    if phone_count > 0:
        score += 1.0 # Score máximo inmediato
        status = "CHEATING_SUSPECTED"
        flags.append("Celular detectado")

    # Regla 2: Conteo de Personas
    if person_count == 0:
        # Si no hay nadie, es muy sospechoso (se fue) pero no necesariamente trampa activa.
        score += 0.6 
        if status != "CHEATING_SUSPECTED": status = "DISTRACTED"
        flags.append("Usuario ausente")
        
    elif person_count > 1:
        # Más de una persona es trampa casi segura.
        score += 0.9
        status = "CHEATING_SUSPECTED"
        flags.append("Multiples personas detectadas")

    # Normalizar score final
    final_score = min(1.0, score)

    return {
        "status": status,
        "suspicion_score": round(final_score, 2),
        "details": {
            "persons": person_count,
            "phones": phone_count,
            "flags": flags,
            # Opcional: devolver objetos detectados para debug
            # "raw_objects": detected_objects 
        }
    }