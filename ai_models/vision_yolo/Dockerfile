FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY vision_yolo/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --timeout=1000

# Copiar módulo compartido (evidence_store.py)
COPY evidence_store.py /app/evidence_store.py

# Copiar código del worker
COPY vision_yolo/ .

RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

CMD ["python", "main.py"]