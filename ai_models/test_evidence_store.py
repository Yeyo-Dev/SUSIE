"""
test_evidence_store.py — Tests unitarios para evidence_store.py
================================================================
Testea las funciones de cálculo de nivel de infracción y umbral
sin necesidad de Redis ni RabbitMQ.

Ejecutar:  python test_evidence_store.py
"""

import os
import sys

# Asegurar que el módulo evidence_store sea importable
sys.path.insert(0, os.path.dirname(__file__))

from evidence_store import calcular_nivel_infraccion, debe_encolar

# ====================================================================
# CONSTANTES
# ====================================================================
TOLERANCE = 1e-6
total = 0
passed = 0


def check(name: str, actual, expected, tolerance=TOLERANCE):
    """Verifica que el valor actual sea cercano al esperado."""
    global total, passed
    total += 1

    if isinstance(expected, bool):
        if actual == expected:
            passed += 1
            print(f"✅ {name}  →  {actual}")
        else:
            print(f"❌ {name}  →  {actual} (esperado: {expected})")
    elif isinstance(expected, float):
        if abs(actual - expected) <= tolerance:
            passed += 1
            print(f"✅ {name}  →  {actual:.4f}")
        else:
            print(f"❌ {name}  →  {actual:.4f} (esperado: {expected:.4f}, diff: {abs(actual - expected):.2e})")
    else:
        if actual == expected:
            passed += 1
            print(f"✅ {name}  →  {actual}")
        else:
            print(f"❌ {name}  →  {actual} (esperado: {expected})")


# ====================================================================
# TESTS: calcular_nivel_infraccion
# ====================================================================
print("=" * 60)
print("TESTS: calcular_nivel_infraccion()")
print("=" * 60)

# --- Vision (yolo_vision) ---
# Normal = 0.85 → nivel = 0.15
check("Vision: caso normal (P(Normal)=0.85)",
      calcular_nivel_infraccion("yolo_vision", {
          "Normal": 0.85, "Ausente": 0.05,
          "Objeto_Prohibido": 0.05, "Multitud": 0.05
      }), 0.15)

# Normal = 0.10 → nivel = 0.90
check("Vision: celular detectado (P(Normal)=0.10)",
      calcular_nivel_infraccion("yolo_vision", {
          "Normal": 0.10, "Ausente": 0.05,
          "Objeto_Prohibido": 0.80, "Multitud": 0.05
      }), 0.90)

# Normal = 0.0 → nivel = 1.0
check("Vision: ausente total (P(Normal)=0.0)",
      calcular_nivel_infraccion("yolo_vision", {
          "Normal": 0.0, "Ausente": 0.85,
          "Objeto_Prohibido": 0.10, "Multitud": 0.05
      }), 1.0)

# --- Audio (audio_nlp) ---
# Silencio + Neutral = 0.98 → nivel = 0.02
check("Audio: silencio (P(Silencio)+P(Neutral)=0.98)",
      calcular_nivel_infraccion("audio_nlp", {
          "Silencio": 0.97, "Neutral": 0.01,
          "Domestico": 0.01, "Sospechoso": 0.01
      }), 0.02)

# Silencio + Neutral = 0.17 → nivel = 0.83
check("Audio: sospechoso (P(Silencio)+P(Neutral)=0.17)",
      calcular_nivel_infraccion("audio_nlp", {
          "Silencio": 0.02, "Neutral": 0.15,
          "Domestico": 0.60, "Sospechoso": 0.23
      }), 0.83)

# --- Gaze (gaze_tracker) ---
# Concentrado = 0.65 → nivel = 0.35
check("Gaze: concentrado (P(Concentrado)=0.65)",
      calcular_nivel_infraccion("gaze_tracker", {
          "Concentrado": 0.65, "Fuera_de_Pantalla": 0.15,
          "Atencion_Secundaria": 0.10, "Erratico": 0.10
      }), 0.35)

# Concentrado = 0.10 → nivel = 0.90
check("Gaze: errático (P(Concentrado)=0.10)",
      calcular_nivel_infraccion("gaze_tracker", {
          "Concentrado": 0.10, "Fuera_de_Pantalla": 0.40,
          "Atencion_Secundaria": 0.20, "Erratico": 0.30
      }), 0.90)

# --- Source desconocido → debe lanzar ValueError ---
total += 1
try:
    calcular_nivel_infraccion("worker_inexistente", {"A": 1.0})
    print("❌ Source desconocido  →  no lanzó ValueError")
except ValueError:
    passed += 1
    print("✅ Source desconocido  →  ValueError lanzado correctamente")


# ====================================================================
# TESTS: debe_encolar
# ====================================================================
print(f"\n{'=' * 60}")
print("TESTS: debe_encolar() (threshold default = 0.5)")
print("=" * 60)

check("Nivel 0.15 → NO encolar", debe_encolar(0.15), False)
check("Nivel 0.49 → NO encolar", debe_encolar(0.49), False)
check("Nivel 0.50 → SÍ encolar (borde)", debe_encolar(0.50), True)
check("Nivel 0.51 → SÍ encolar", debe_encolar(0.51), True)
check("Nivel 0.90 → SÍ encolar", debe_encolar(0.90), True)
check("Nivel 1.00 → SÍ encolar", debe_encolar(1.00), True)
check("Nivel 0.00 → NO encolar", debe_encolar(0.00), False)


# ====================================================================
# RESULTADO
# ====================================================================
print(f"\n{'=' * 60}")
print(f"Resultado: {passed}/{total} tests pasaron")
if passed == total:
    print("🎉 Todas las verificaciones pasaron.")
else:
    print("⚠️  Algunos tests fallaron.")
    exit(1)
