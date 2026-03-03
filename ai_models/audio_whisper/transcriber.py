from faster_whisper import WhisperModel
import os

# Configuración: 'tiny' es súper rápido. 'base' es más preciso.
# Int8 = True hace que ocupe menos RAM.
MODEL_SIZE = "medium" 

print(f"⏳ Cargando modelo Whisper ({MODEL_SIZE})...")
try:
    # run_opts={"device": "cpu"} fuerza el uso de CPU
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    print("✅ Modelo de Audio cargado en memoria.")
except Exception as e:
    print(f"❌ Error cargando modelo: {e}")
    model = None

def transcribir_audio(audio_numpy):
    if model is None: return ""
    try:
        # vad_filter=True es VITAL. Ignora partes donde no hay voz humana clara.
        # min_silence_duration_ms: Ignora ruidos cortos (golpes, clicks)
        segments, info = model.transcribe(
            audio_numpy, 
            beam_size=5, 
            language="es", 
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        texto_completo = ""
        for segment in segments:
            texto_completo += segment.text + " "
            
        return texto_completo.strip()
    except Exception as e:
        print(f"Error transcribiendo: {e}")
        return ""