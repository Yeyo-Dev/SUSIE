import numpy as np
from scipy.signal import butter, lfilter
import subprocess
import io

def butter_bandpass(lowcut, highcut, fs, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def aplicar_filtro_voz(audio_data, rate=16000):
    """
    Deja pasar solo frecuencias de voz humana (300Hz - 3400Hz).
    Elimina ruido grave (golpes) y agudo (interferencia).
    """
    # Rango telefónico estándar para voz inteligible
    lowcut = 300.0
    highcut = 3400.0
    
    b, a = butter_bandpass(lowcut, highcut, rate, order=6)
    y = lfilter(b, a, audio_data)
    return y.astype(np.float32)

def es_silencio(audio_data, umbral_db=-40):
    """
    Calcula si el audio es puro ruido de fondo o silencio.
    Retorna True si el volumen es muy bajo.
    """
    # Calcular RMS (Root Mean Square) -> Volumen promedio
    rms = np.sqrt(np.mean(audio_data**2))
    
    # Convertir a Decibeles
    # Evitar log(0) sumando un epsilon pequeño
    db = 20 * np.log10(rms + 1e-9)
    
    # Si el volumen es menor al umbral (ej. -40dB), es silencio
    return db < umbral_db

def convertir_a_numpy(file_bytes):
    """
    Usa FFmpeg para convertir cualquier cosa (webm, mp3) a array numpy raw float32
    """
    try:
        process = subprocess.Popen(
            ['ffmpeg', '-i', 'pipe:0', '-f', 's16le', '-ac', '1', '-ar', '16000', 'pipe:1'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )
        out, _ = process.communicate(input=file_bytes)
        
        # Convertir bytes a int16 y luego normalizar a float32 (-1.0 a 1.0)
        audio_int16 = np.frombuffer(out, np.int16)
        return audio_int16.astype(np.float32) / 32768.0
    except Exception as e:
        print(f"Error FFmpeg: {e}")
        return None