# GAZE TRACKING SERVICE REFACTOR - EXECUTIVE SUMMARY

**Documento**: Resumen ejecutivo del análisis y plan de descomposición  
**Fecha**: 2026-03-11  
**Estado**: ✅ LISTO PARA IMPLEMENTACIÓN  

---

## 📊 SITUACIÓN ACTUAL

### Problemas
- **634 líneas de código** en un único servicio monolítico
- **5-6 responsabilidades** completamente entrelazadas
- **Testabilidad NULA**: No hay forma de testear sin editar el código
- **Reusabilidad CERO**: Métodos privados podrían ser sub-servicios
- **Duplicación de datos**: WebGazer emite de dos formas en paralelo
- **Workarounds sin encapsulación**: MutationObserver mezclado con lógica de negocio

### Impacto
- Bugs difíciles de aislar
- Imposible escalar (agregar features rompe todo)
- Onboarding complejo para nuevos devs
- Deuda técnica acumulada

---

## 🎯 SOLUCIÓN PROPUESTA

**Patrón**: Facade Pattern + 6 Sub-servicios especializados

### Arquitectura Nueva

```
GazeTrackingFacade (interfaz pública - SIN CAMBIOS)
    ↓
├─ GazeCalibrationService        (Calibración)
├─ GazePredictionService         (Tracking + Polling)
├─ GazeSmoothingService          (Suavizado matemático)
├─ GazeMetricsService            (Buffer + Telemetría)
├─ GazeDeviationDetectionService (Detección desviación)
└─ GazeWebGazerMutingService     (Workaround video muting)
```

### Beneficios

| Beneficio | Impacto |
|-----------|--------|
| **Testabilidad** | Pasar de 0% a 80%+ coverage |
| **Reusabilidad** | Sub-servicios independientes |
| **Mantenibilidad** | Cambios localizados, sin cascada |
| **Performance** | Mejor con lógica separada |
| **Backward Compat** | Interfaz pública IDÉNTICA |
| **Escalabilidad** | Fácil agregar features |

---

## 📋 RESPONSABILIDADES POR SERVICIO

### 1️⃣ GazeCalibrationService
**Qué**: Gestionar proceso de calibración inicial  
**Métodos**: `startCalibration()`, `recordCalibrationClick()`, `completeCalibration()`, `resetCalibration()`  
**Estado**: `isCalibrated`, `gazeFrameCount`, `webgazer`, `calibrationData`  
**Líneas del original**: 104-194  

### 2️⃣ GazePredictionService
**Qué**: Capturar predicciones en tiempo real (listener + polling)  
**Métodos**: `startTracking()`, `stopTracking()`, `setGazeListener()`  
**Estado**: `isTracking`, `gazeFrameCount`, `pollingRafId`, `lastPollTime`  
**Líneas del original**: 528-589 + listener setup  

### 3️⃣ GazeSmoothingService
**Qué**: Normalizar y suavizar coordenadas (píxel → [-1,1])  
**Métodos**: `smoothAndNormalize()`, `reset()`, `setSmootingWindow()`  
**Estado**: `xHistory[]`, `yHistory[]`  
**Líneas del original**: 309-363  
**Criticidad**: ⭐⭐⭐ (CORE, 100% determinista)  

### 4️⃣ GazeMetricsService
**Qué**: Agregar puntos suavizados para telemetría  
**Métodos**: `recordPoint()`, `flushBuffer()`, `getBuffer()`, `reset()`  
**Estado**: `gazeBuffer[]`, `maxBufferSize`, `stats`  
**Líneas del original**: 260-271 + buffer logic  

### 5️⃣ GazeDeviationDetectionService
**Qué**: Detectar cuando la mirada sale del área de pantalla  
**Métodos**: `startMonitoring()`, `stopMonitoring()`, `evaluatePoint()`, `getDeviationStatus()`  
**Estado**: `isDeviated`, `deviationStartTime`, `checkInterval`  
**Líneas del original**: 369-415  

### 6️⃣ GazeWebGazerMutingService
**Qué**: Encapsular workaround para silenciar videos de WebGazer  
**Métodos**: `startMuting()`, `stopMuting()`, `muteAllVideos()`  
**Estado**: `muteObserver`, `muteRetryInterval`  
**Líneas del original**: 420-521  
**Nota**: Infraestructura (no negocio)  

---

## 🔄 FLUJO DE DATOS

```
Fase 1: CALIBRACIÓN
WebGazer.begin() → Listener creado → MutingService inicia

Fase 2: TRANSICIÓN
completeCalibration() → PredictionService.startTracking() 
                     → DeviationService.startMonitoring()

Fase 3: TRACKING ACTIVO
WebGazer (listener + polling)
    → PredictionService.predictionReceived$
    → SmoothingService.smoothAndNormalize()
    → lastPoint signal + MetricsService + DeviationService

Fase 4: DETENCIÓN
stop() → todos los servicios se detienen
```

---

## 📈 TIMELINE & ESFUERZO

| Fase | Tarea | Duración | Status |
|------|-------|----------|--------|
| 0 | Preparación (setup, stubs) | 1-2 días | ⏳ TODO |
| 1 | GazeCalibrationService | 2-3 días | ⏳ TODO |
| 2 | GazePredictionService | 2-3 días | ⏳ TODO |
| 3 | GazeSmoothingService | 1-2 días | ⏳ TODO |
| 4 | GazeMetricsService | 1 día | ⏳ TODO |
| 5 | GazeDeviationDetectionService | 1-2 días | ⏳ TODO |
| 6 | GazeWebGazerMutingService | 1 día | ⏳ TODO |
| 7 | Facade + Orquestación | 2-3 días | ⏳ TODO |
| 8 | Tests + Limpieza | 1-2 días | ⏳ TODO |

**Total**: **3-4 semanas realistas** (con testing exhaustivo)

---

## ✅ CHECKLIST ANTES DE EMPEZAR

- [ ] Aprobación de arquitectura por lead técnico
- [ ] Equipo entiende el plan
- [ ] Rama creada: `feature/gaze-refactor-descomposicion`
- [ ] Documentos listos:
  - [x] GAZE-REFACTOR-PLAN.md (completo)
  - [x] GAZE-DATAFLOW-DIAGRAM.md (flujo)
  - [x] GAZE-IMPLEMENTATION-CHECKLIST.md (paso a paso)
- [ ] Setup de testing (jest, mocks de WebGazer)
- [ ] Tag de backup: `gaze-refactor-start`

---

## 🚀 PRÓXIMOS PASOS

### Inmediato (HOY)
1. Revisar este documento con el equipo
2. Aprobación de arquitectura
3. Crear rama feature
4. Setup Fase 0 (preparación)

### Corto Plazo (Esta semana)
1. Implementar Fase 1-2 (Calibration + Prediction)
2. Tests unitarios
3. Integración en Facade (básica)

### Mediano Plazo (Próximas 2 semanas)
1. Implementar Fase 3-6 (Smoothing, Metrics, Deviation, Muting)
2. Tests completos
3. Validar en staging

### Pre-Merge
1. Tests + Coverage >= 80%
2. PR review
3. Staging test
4. Merge a main

---

## 📚 DOCUMENTOS DE REFERENCIA

| Documento | Propósito |
|-----------|-----------|
| **GAZE-REFACTOR-PLAN.md** | Plan completo, arquitectura, mitigación de riesgos |
| **GAZE-DATAFLOW-DIAGRAM.md** | Diagramas visuales, flujos, ciclo de vida |
| **GAZE-IMPLEMENTATION-CHECKLIST.md** | Checklist paso a paso por fase |
| **Este documento** | Resumen ejecutivo para toma de decisiones |

---

## ⚠️ RIESGOS IDENTIFICADOS

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|-----------|
| Regresión tracking | MEDIA | ALTO | Tests exhaustivos + staging |
| Memory leak RAF | BAJA | ALTO | Validar cleanup, DevTools |
| WebGazer timing | BAJA | ALTO | Isolar en CalibrationService |
| Breaking changes | MUY BAJA | ALTO | Interfaz pública sin cambios |
| Performance degraded | BAJA | MEDIO | Benchmarking vs original |

---

## 🎓 KEY LEARNINGS

1. **GazeTrackingService no es monolítico por laziness, es por evolución**
   - WebGazer tiene quirks (timing issues con videos)
   - Workarounds se acumularon sin encapsulación
   - Solución: Aislar en GazeWebGazerMutingService

2. **El corazón es `processRawGaze()`**
   - Escala y suaviza: crítico para precisión
   - Debe ser 100% determinista y testeable
   - Extraer a GazeSmoothingService (puro, sin deps)

3. **WebGazer emite de DOS formas**
   - Callback setGazeListener (listener pattern)
   - Polling manual (getCurrentPrediction + RAF)
   - Ambas en paralelo = confusión
   - Solución: GazePredictionService unifica en Observable

4. **Facade Pattern es la clave**
   - Mantiene interfaz idéntica (backward compatible)
   - Orquesta 6 servicios sin inyección circular
   - Permite refactor gradual sin breaking changes

---

## 💡 DECISIONES ARQUITECTÓNICAS

| Decisión | Razón | Alternativa Rechazada |
|----------|-------|----------------------|
| **Facade Pattern** | Backward compat + testabilidad | Rewrite completo (riesgoso) |
| **6 servicios** | Responsabilidad única + testeable | 3 servicios grandes (complejo) |
| **RxJS Observables** | Loose coupling, no circular deps | Direct injection (tight coupling) |
| **DestroyRefUtility** | Ya en uso, patrón establecido | Manual cleanup (error prone) |
| **Signal como públicos** | Reactivity Angular, UI friendly | Subjects (inconsistencia) |

---

## 📞 CONTACTO & SOPORTE

**Dudas sobre el plan?**
- Revisar documentos de referencia
- Consultar Insights guardados en Engram
- Hacer preguntas en planificación

**Durante implementación?**
- Seguir checklist paso a paso
- Validar tests pasan
- Consultar diagramas de flujo

---

## 🏁 CONCLUSIÓN

Este refactor es **CRITICAL** para la mantenibilidad de SUSIE. La arquitectura propuesta:
- ✅ Resuelve todos los problemas identificados
- ✅ Mantiene backward compatibility
- ✅ Es implementable en 3-4 semanas
- ✅ Mejora testabilidad, escalabilidad y performance
- ✅ Sigue patrones Angular modernos

**Status**: LISTO PARA COMENZAR 🚀

---

**Generado**: 2026-03-11  
**Versión**: 1.0  
**Aprobado por**: [PENDIENTE TU APROBACIÓN]
