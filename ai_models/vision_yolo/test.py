"""
test.py — Tests unitarios para el Worker de Visión (YOLOv8)
============================================================
Testea soft_evidence.normalizar_vision() sin necesidad de cargar
el modelo YOLO ni tener acceso a la red.

Ejecutar:  python test.py
"""

import json
from soft_evidence import normalizar_vision

# ====================================================================
# CONSTANTES
# ====================================================================
TOLERANCE = 1e-9
EXPECTED_KEYS = {"Normal", "Ausente", "Objeto_Prohibido", "Multitud"}
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

    # Verificar serialización JSON
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
print("TESTS: soft_evidence.normalizar_vision()")
print("=" * 60)

# Casos normales
check("Normal: 1 persona, sin objetos",
      normalizar_vision(1, 0.0, False, False))

check("Ausente: 0 personas",
      normalizar_vision(0, 0.0, False, False))

check("Celular: confidence = 0.85",
      normalizar_vision(1, 0.85, True, False))

check("Celular: confidence = 0.40",
      normalizar_vision(1, 0.40, True, False))

check("Multitud: 2 personas",
      normalizar_vision(2, 0.0, False, True))

check("Multitud: 5 personas",
      normalizar_vision(5, 0.0, False, True))

# Edge cases
check("Edge: phone_detected=True, confidence=0.0",
      normalizar_vision(1, 0.0, True, False))

check("Edge: confidence = 1.0",
      normalizar_vision(1, 1.0, True, False))

check("Edge: 0 personas + celular (prioridad Ausente)",
      normalizar_vision(0, 0.75, True, False))

# Semántica: verificar que el estado dominante sea el esperado
d = normalizar_vision(0, 0.0, False, False)
assert d["Ausente"] > d["Normal"], "Ausente debería dominar si person_count == 0"

d = normalizar_vision(1, 0.85, True, False)
assert d["Objeto_Prohibido"] > d["Normal"], "Objeto_Prohibido debería dominar con celular"

d = normalizar_vision(1, 0.0, False, False)
assert d["Normal"] > d["Ausente"], "Normal debería dominar en caso base"

print(f"\n{'=' * 60}")
print(f"Resultado: {passed}/{total} tests pasaron")
if passed == total:
    print("🎉 Todas las distribuciones son válidas.")
else:
    print("⚠️  Algunos tests fallaron.")
    exit(1)
