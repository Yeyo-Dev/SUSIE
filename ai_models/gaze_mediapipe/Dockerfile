FROM python:3.10-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY gaze_mediapipe/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Copiar módulo compartido
COPY evidence_store.py /app/evidence_store.py
# Copiar código del worker
COPY gaze_mediapipe/ .
CMD ["python", "main.py"]