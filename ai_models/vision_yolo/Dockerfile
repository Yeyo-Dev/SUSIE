FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --timeout=1000

COPY . .

RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Como es un worker que solo escucha colas, ya no necesita exponer puertos
# EXPOSE 8003 (Puedes borrar esta línea)

CMD ["python", "main.py"]