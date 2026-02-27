import json
import os
import numpy as np
from dotenv import load_dotenv

load_dotenv()
DB_FILE = os.getenv("DB_FILE", "database.json")

class BiometricStorage:
    def __init__(self):
        self._ensure_db()

    def _ensure_db(self):
        if not os.path.exists(DB_FILE):
            with open(DB_FILE, 'w') as f:
                json.dump({}, f)

    def _load_db(self):
        try:
            with open(DB_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _save_db(self, data):
        with open(DB_FILE, 'w') as f:
            json.dump(data, f, indent=4)

    def guardar_biometrico(self, user_id: str, vector: np.ndarray):
        """Guarda el vector convirtiéndolo a lista"""
        db = self._load_db()
        db[user_id] = vector.tolist()
        self._save_db(db)
        return True

    def obtener_biometrico(self, user_id: str):
        """Recupera el vector y lo reconvierte a numpy array"""
        db = self._load_db()
        if user_id not in db:
            return None
        return np.array(db[user_id], dtype=np.float64)

# Instancia global
db_service = BiometricStorage()