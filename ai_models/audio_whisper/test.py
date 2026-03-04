"""
test.py — Tests unitarios para el Worker de Audio (Whisper + NLP)
=================================================================
Testea soft_evidence.normalizar_audio() sin necesidad de cargar
Whisper ni SentenceTransformers.

Ejecutar:  python test.py
"""

import json
from soft_evidence import normalizar_audio

# ====================================================================
# CONSTANTES
# ====================================================================
TOLERANCE = 1e-9
EXPECTED_KEYS = {"Silencio", "Neutral", "Domestico", "Sospechoso"}
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
print("TESTS: soft_evidence.normalizar_audio()")
print("=" * 60)

# Casos normales
check("Silencio puro",
      normalizar_audio(True))

check("Voz neutral (scores bajos)",
      normalizar_audio(False, 0.1, 0.1))

check("Voz sospechosa (score trampa alto)",
      normalizar_audio(False, 0.8, 0.2))

check("Voz doméstica (score doméstico alto)",
      normalizar_audio(False, 0.1, 0.75))

check("Scores iguales",
      normalizar_audio(False, 0.5, 0.5))

# Temperature Scaling
check("Temperatura baja T=0.5 (puntiaguda)",
      normalizar_audio(False, 0.8, 0.2, temperatura=0.5))

check("Temperatura alta T=3.0 (uniforme)",
      normalizar_audio(False, 0.8, 0.2, temperatura=3.0))

check("Temperatura estándar T=1.0",
      normalizar_audio(False, 0.8, 0.2, temperatura=1.0))

# Edge cases
check("Edge: scores negativos",
      normalizar_audio(False, -0.1, -0.2))

check("Edge: scores = 0.0",
      normalizar_audio(False, 0.0, 0.0))

check("Edge: scores altísimos",
      normalizar_audio(False, 0.99, 0.99))

# Semántica: verificar comportamiento correcto
d = normalizar_audio(True)
assert d["Silencio"] > 0.90, "Silencio debería dominar en caso de silencio"

d = normalizar_audio(False, 0.8, 0.1, temperatura=1.0)
assert d["Sospechoso"] > d["Domestico"], "Sospechoso debería superar a Doméstico"

d = normalizar_audio(False, 0.1, 0.8, temperatura=1.0)
assert d["Domestico"] > d["Sospechoso"], "Doméstico debería superar a Sospechoso"

# Verificar que Temperatura baja produce distribución más concentrada
d_low_t = normalizar_audio(False, 0.8, 0.2, temperatura=0.5)
d_high_t = normalizar_audio(False, 0.8, 0.2, temperatura=3.0)
assert max(d_low_t.values()) > max(d_high_t.values()), \
    "T baja debería producir distribución más puntiaguda que T alta"

print(f"\n{'=' * 60}")
print(f"Resultado: {passed}/{total} tests pasaron")
if passed == total:
    print("🎉 Todas las distribuciones son válidas.")
else:
    print("⚠️  Algunos tests fallaron.")
    exit(1)
