# 1. Usamos la imagen que ya tiene dlib y face_recognition pre-compilados
FROM animcogn/face_recognition:latest

# 2. Directorio de trabajo
WORKDIR /app

# 3. Copiamos requirements e instalamos dependencias de API
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Instalamos opencv-headless (versión ligera para servidores sin pantalla)
RUN pip install opencv-python-headless

# 5. Copiamos el resto del código
COPY . .

# 6. Exponemos el puerto
EXPOSE 8000

# 7. Ejecutamos la API leyendo las variables del sistema
CMD ["python", "main.py"]