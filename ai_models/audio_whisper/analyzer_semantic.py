import json
from sentence_transformers import SentenceTransformer, util
import torch
import os

class SemanticAnalyzer:
    def __init__(self, dataset_path="frases_entrenamiento.json"):
        print("⏳ Cargando modelo Semántico...")
        self.model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        
        self.frases_trampa = []
        self.frases_domesticas = []

        if os.path.exists(dataset_path):
            with open(dataset_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                # --- LÓGICA NUEVA PARA TU JSON ---
                # Recorremos la lista "dataset" y clasificamos según el "label"
                for item in data.get("dataset", []):
                    texto = item.get("text")
                    label = item.get("label")
                    
                    if label == "SOSPECHOSO":
                        self.frases_trampa.append(texto)
                    elif label == "DOMESTICO":
                        self.frases_domesticas.append(texto)
                # ---------------------------------
        else:
            # Fallback por si falla el archivo
            self.frases_trampa = ["pásame la respuesta", "busca en google"]
            self.frases_domesticas = ["mamá cierra la puerta", "bájale a la música"]

        # Validación de seguridad
        if not self.frases_trampa: print("⚠️ ALERTA: No se cargaron frases de trampa.")
        
        print(f"🧠 Memorizando {len(self.frases_trampa)} frases de TRAMPA y {len(self.frases_domesticas)} DOMÉSTICAS...")
        
        # Convertir a Vectores (Embeddings)
        self.embeddings_trampa = self.model.encode(self.frases_trampa, convert_to_tensor=True)
        self.embeddings_domestico = self.model.encode(self.frases_domesticas, convert_to_tensor=True)
        
        print("✅ Analizador listo.")

    def analizar(self, texto_alumno):
        if not texto_alumno or len(texto_alumno.split()) < 2:
            return {"category": "NEUTRAL", "score": 0.0, "flagged": False}

        # 1. Convertir lo que dijo el alumno a vector
        embedding_alumno = self.model.encode(texto_alumno, convert_to_tensor=True)

        # 2. Comparar contra TRAMPAS (Similitud Coseno)
        # util.cos_sim devuelve una matriz, tomamos el valor máximo (la frase a la que más se pareció)
        scores_trampa = util.cos_sim(embedding_alumno, self.embeddings_trampa)
        max_score_trampa = torch.max(scores_trampa).item()

        # 3. Comparar contra DOMÉSTICO
        scores_domestico = util.cos_sim(embedding_alumno, self.embeddings_domestico)
        max_score_domestico = torch.max(scores_domestico).item()

        # 4. Lógica de Decisión
        # Umbral: 0.4 suele ser bueno. 1.0 es idéntico. 0.0 es nada que ver.
        UMBRAL_ALERTA = 0.55 

        resultado = {
            "text": texto_alumno,
            "category": "NEUTRAL",
            "score": 0.0,
            "flagged": False
        }

        if max_score_trampa > UMBRAL_ALERTA:
            # Si se parece más a trampa que a doméstico
            if max_score_trampa > max_score_domestico:
                resultado["category"] = "SOSPECHOSO"
                resultado["score"] = round(max_score_trampa, 2)
                resultado["flagged"] = True
                return resultado

        if max_score_domestico > UMBRAL_ALERTA:
            resultado["category"] = "DOMESTICO"
            resultado["score"] = round(max_score_domestico, 2)
        
        return resultado

# Instancia global para no recargar el modelo en cada petición
analyzer_service = SemanticAnalyzer()