"""
main.py — API REST Biométrica (FastAPI) — Stateless
=====================================================
Responsabilidad: recibir peticiones HTTP, delegar a biometrics.py,
y retornar JSON. NO guarda nada — el backend principal se encarga
del almacenamiento de vectores en su BD.

Endpoints:
  POST /api/vectorize  → Recibe URL de imagen → Devuelve embedding
  POST /api/compare    → Recibe URL de imagen + vector de BD → Devuelve similitud
  GET  /               → Health check
"""

import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import biometrics

# --- Configuración ---
load_dotenv()
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app = FastAPI(title="Biometric AI Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Models ---
class VectorizeRequest(BaseModel):
    """El backend envía la URL de la imagen subida a Azure Blob."""
    image_url: str


class CompareRequest(BaseModel):
    """
    El backend envía:
      - image_url: URL de la nueva foto (Azure Blob)
      - vector_db: el embedding guardado en su BD (lista de 128 floats)
      - umbral: distancia máxima para considerar match (opcional, default 0.5)
    """
    image_url: str
    vector_db: list[float]
    umbral: float = 0.5


# --- Health Check ---
@app.get("/")
def health_check():
    return {"status": "online", "service": "Biometric AI (Stateless)"}


# --- ENDPOINT 1: VECTORIZAR ---
@app.post("/api/vectorize")
async def vectorizar(req: VectorizeRequest):
    """
    Descarga la imagen desde Azure Blob, detecta el rostro,
    y retorna el embedding de 128 dimensiones.

    El backend guardará este vector en su BD asociado al usuario.
    """
    # 1. Descargar imagen desde Azure Blob
    imagen = biometrics.descargar_imagen(req.image_url)
    if imagen is None:
        raise HTTPException(
            status_code=400,
            detail="No se pudo descargar o decodificar la imagen desde la URL proporcionada."
        )

    # 2. Generar embedding facial
    vector = biometrics.generar_vector(imagen)
    if vector is None:
        raise HTTPException(
            status_code=422,
            detail="No se detectó un rostro claro en la imagen. "
                   "Pide al usuario que tome otra foto con mejor iluminación."
        )

    # 3. Retornar vector como lista (JSON-serializable)
    return {
        "face_detected": True,
        "embedding": vector.tolist(),
        "dimensions": len(vector),
    }


# --- ENDPOINT 2: COMPARAR ---
@app.post("/api/compare")
async def comparar(req: CompareRequest):
    """
    Descarga la nueva imagen desde Azure Blob, la vectoriza,
    y la compara contra el vector almacenado en la BD del backend.

    Retorna si es match + porcentaje de similitud.
    """
    # 1. Validar que el vector de BD tenga las dimensiones correctas
    if len(req.vector_db) != 128:
        raise HTTPException(
            status_code=400,
            detail=f"El vector de BD debe tener 128 dimensiones, recibí {len(req.vector_db)}."
        )

    # 2. Descargar y vectorizar la nueva imagen
    imagen = biometrics.descargar_imagen(req.image_url)
    if imagen is None:
        raise HTTPException(
            status_code=400,
            detail="No se pudo descargar o decodificar la imagen desde la URL proporcionada."
        )

    vector_nuevo = biometrics.generar_vector(imagen)
    if vector_nuevo is None:
        raise HTTPException(
            status_code=422,
            detail="No se detectó un rostro en la nueva imagen."
        )

    # 3. Comparar vectores
    resultado = biometrics.comparar_vectores(
        vector_db=req.vector_db,
        vector_nuevo=vector_nuevo,
        umbral=req.umbral,
    )

    return resultado


if __name__ == "__main__":
    print(f"Iniciando Biometric AI Service en {API_HOST}:{API_PORT}")
    uvicorn.run(app, host=API_HOST, port=API_PORT)