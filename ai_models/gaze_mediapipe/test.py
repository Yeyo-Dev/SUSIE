"""
test.py — Tests unitarios para el Worker de Gaze Tracking
==========================================================
Testea soft_evidence.normalizar_gaze() sin necesidad de tener
coordenadas de mirada reales ni DBSCAN/IsolationForest.

Ejecutar:  python test.py
"""

import json
from soft_evidence import normalizar_gaze

# ====================================================================
# CONSTANTES
# ====================================================================
TOLERANCE = 1e-9
EXPECTED_KEYS = {"Concentrado", "Fuera_de_Pantalla", "Atencion_Secundaria", "Erratico"}
total = 0
passed = 0


def check(name, dist):
    """Verifica claves, suma = 1.0, y no negativos."""
    global total, passed
    total += 1
    errors = []

    if set(dist.keys()) != EXPECTED_KEYS:
        errors.append(f"  Claves: {set(dist.keys())} != {EXPECTED_KEYS}")

    s = sum(dist.values())
    if abs(s - 1.0) > TOLERANCE:
        errors.append(f"  Σ = {s} (diff: {s - 1.0:.2e})")

    for k, v in dist.items():
        if v < 0:
            errors.append(f"  {k} = {v} (negativo)")

    try:
        json.dumps(dist)
    except (TypeError, ValueError) as e:
        errors.append(f"  No serializable a JSON: {e}")

    if errors:
        print(f"❌ {name}")
        for e in errors:
            print(e)
        print(f"  → {dist}")
    else:
        passed += 1
        print(f"✅ {name}  →  {dist}")


# ====================================================================
# TESTS
# ====================================================================
print("=" * 60)
print("TESTS: soft_evidence.normalizar_gaze()")
print("=" * 60)

# Casos normales
check("Concentrado: todos los ratios = 0",
      normalizar_gaze(0.0, 0.0, 0.0))

check("Fuera de pantalla: alto OOB",
      normalizar_gaze(0.8, 0.0, 0.0))

check("Atención secundaria: DBSCAN cluster grande",
      normalizar_gaze(0.0, 0.5, 0.0))

check("Errático: muchas anomalías",
      normalizar_gaze(0.0, 0.0, 0.7))

check("Mixto: múltiples señales",
      normalizar_gaze(0.3, 0.2, 0.3))

check("Máximas alertas: todo al máximo",
      normalizar_gaze(1.0, 1.0, 1.0))

# Edge cases (clamp protection)
check("Edge: valores negativos (→ clamp a 0)",
      normalizar_gaze(-0.5, -0.3, -0.1))

check("Edge: valores > 1.0 (→ clamp a 1.0)",
      normalizar_gaze(2.0, 1.5, 3.0))

check("Edge: valores muy pequeños",
      normalizar_gaze(0.01, 0.01, 0.01))

check("Edge: solo un ratio alto",
      normalizar_gaze(0.95, 0.0, 0.0))

# Semántica
d = normalizar_gaze(0.0, 0.0, 0.0)
assert d["Concentrado"] > 0.80, "Concentrado debería dominar sin señales de alerta"

d = normalizar_gaze(0.8, 0.0, 0.0)
assert d["Fuera_de_Pantalla"] > d["Concentrado"], \
    "Fuera_de_Pantalla debería dominar con alto OOB"

d = normalizar_gaze(0.0, 0.5, 0.0)
assert d["Atencion_Secundaria"] > d["Erratico"], \
    "Atencion_Secundaria debería superar a Erratico cuando solo hay cluster"

d = normalizar_gaze(0.0, 0.0, 0.7)
assert d["Erratico"] > d["Atencion_Secundaria"], \
    "Erratico debería dominar con alto anomaly_ratio"

# Concentrado decrece conforme suben las alertas
d1 = normalizar_gaze(0.1, 0.0, 0.0)
d2 = normalizar_gaze(0.5, 0.2, 0.3)
assert d1["Concentrado"] > d2["Concentrado"], \
    "Concentrado debería ser inversamente proporcional a las alertas"

print(f"\n{'=' * 60}")
print(f"Resultado: {passed}/{total} tests pasaron")
if passed == total:
    print("🎉 Todas las distribuciones son válidas.")
else:
    print("⚠️  Algunos tests fallaron.")
    exit(1)
