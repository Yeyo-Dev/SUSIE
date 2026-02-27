import os
import uvicorn
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Importar nuestros módulos locales
import biometrics
from storage import db_service

# 1. Cargar Configuración
load_dotenv()
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app = FastAPI(title="Biometric Auth API")

# 2. Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "online", "system": "Biometric API Dockerized"}

# --- ENDPOINT 1: REGISTRO ---
@app.post("/api/register")
async def registrar_usuario(
    username: str = Form(...), 
    file: UploadFile = File(...)
):
    print(f"Registrando a: {username}")
    
    # Leer y Procesar
    content = await file.read()
    imagen_limpia = biometrics.process_image_bytes(content)
    
    if imagen_limpia is None:
        raise HTTPException(status_code=400, detail="Imagen corrupta o formato inválido")

    # Vectorizar
    vector = biometrics.generar_vector(imagen_limpia)
    if vector is None:
        raise HTTPException(status_code=400, detail="No se detectó rostro en la imagen")

    # Guardar
    db_service.guardar_biometrico(username, vector)
    
    return {"message": "Usuario registrado", "user": username}

# --- ENDPOINT 2: VALIDACIÓN ---
@app.post("/api/validate")
async def validar_usuario(
    username: str = Form(...), 
    file: UploadFile = File(...)
):
    print(f"Validando a: {username}")

    # Buscar usuario
    vector_db = db_service.obtener_biometrico(username)
    if vector_db is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Procesar foto entrante
    content = await file.read()
    imagen_limpia = biometrics.process_image_bytes(content)
    
    # Vectorizar foto nueva
    vector_nuevo = biometrics.generar_vector(imagen_limpia)
    if vector_nuevo is None:
        raise HTTPException(status_code=400, detail="No se detectó rostro en la cámara")

    # Comparar
    es_match, distancia = biometrics.comparar_vectores(vector_db, vector_nuevo)

    return {
        "auth": es_match,
        "distance": round(distancia, 4),
        "message": "Acceso Permitido" if es_match else "Rostro no coincide"
    }

if __name__ == "__main__":
    print(f"🚀 Iniciando servidor en {API_HOST}:{API_PORT}")
    uvicorn.run(app, host=API_HOST, port=API_PORT)