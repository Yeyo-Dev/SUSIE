"""
config.py — Configuración centralizada del Motor de Inferencia
===============================================================
Todas las variables de entorno se leen aquí y se exponen como constantes.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── RabbitMQ ─────────────────────────────────────────────────
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASS = os.getenv("RABBITMQ_PASS", "guest")

QUEUE_INPUT = "q_evidencia"       # Cola de entrada (batch al cierre de sesión)
QUEUE_INFRACCIONES = "q_infracciones"

# ── Redis ────────────────────────────────────────────────────
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

# ── PostgreSQL ───────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/susie"
)

# ── Azure Blob Storage ──────────────────────────────────────
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_CONTAINER_NAME = os.getenv("AZURE_CONTAINER_NAME", "susie-dictamenes")

# ── Motor de Inferencia ─────────────────────────────────────
# Ventana temporal (segundos) para agrupar evidencias multisensor
FUSION_WINDOW_SECONDS = int(os.getenv("FUSION_WINDOW_SECONDS", "30"))

# Umbral de muerte súbita — si P(fraude) >= este valor, dictamen automático
MUERTE_SUBITA_THRESHOLD = float(os.getenv("MUERTE_SUBITA_THRESHOLD", "0.95"))

# Umbral para considerar un momento como "sospechoso" en el JSON de salida
SOSPECHOSO_THRESHOLD = float(os.getenv("SOSPECHOSO_THRESHOLD", "0.40"))

# Clasificación final
UMBRAL_CONFIABLE = float(os.getenv("UMBRAL_CONFIABLE", "0.25"))
UMBRAL_SOSPECHOSO = float(os.getenv("UMBRAL_SOSPECHOSO", "0.60"))
# >= UMBRAL_SOSPECHOSO → IRREGULAR
# >= UMBRAL_CONFIABLE y < UMBRAL_SOSPECHOSO → SOSPECHOSO
# < UMBRAL_CONFIABLE → CONFIABLE
