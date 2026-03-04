FROM python:3.10-slim

WORKDIR /app

# 1. Instalar FFmpeg (Vital para el audio)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# 2. Instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copiar código
COPY . .

# 4. Lanzar el worker (sin exponer puertos)
CMD ["python", "main.py"]