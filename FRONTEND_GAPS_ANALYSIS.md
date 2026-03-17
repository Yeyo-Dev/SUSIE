# 🔍 Frontend GAPS Analysis — SUSIE

> **Fecha:** 16 Marzo 2026
> **Fuente:** Análisis exhaustivo del código fuente vs documentación
> **Archivo relacionado:** `TAREAS_FRONTEND_PENDIENTES.md`

---

## 📊 Resumen Ejecutivo

| Categoría | Estado | Impacto |
|-----------|--------|---------|
| **Tests de GazeTrackingService** | CERO tests | CRÍTICO |
| **GazeTracking Refactor** | Documentado, NOimplementado | IMPORTANTE |
| **Session Recovery** | NO existe | IMPORTANTE |
| **Environment Check** | Básico, falta avanzado | IMPORTANTE |
| **Tests de componentes** | Faltan specs | MENOR |
| **Accesibilidad (a11y)** | Parcial | MENOR |
| **Internacionalización** | AUSENTE | MENOR |

---

## 🔴 CRÍTICO — Bloqueaconfiabilidad

### 1. Tests de GazeTrackingService

**Archivo:** `frontend/projects/ngx-susie-proctoring/src/lib/services/gaze-tracking.service.ts`

**Problema:**
- **1157 líneas** de código SIN tests
- Servicio monolítico con6 responsabilidades mezcladas:
  1. Calibración de gaze
  2. Predicción de coordenadas
  3. Suavizado de señales
  4. Métricas de desviación
  5. Detección de desviación
  6. Mutingsupresor de eventos periódicos)

**Riesgo:**
- Cualquier cambio rompe funcionalidad sin detección
- Refactor posterior es imposible sin regression tests
- Merge conflicts frecuentes por archivo gigante

**Solución propuesta:**
```typescript
// Antes: gaze-tracking.service.ts (1157 líneas)
// Después:
services/
├── gaze/
│   ├── calibration.service.ts      // ~150 líneas
│   ├── prediction.service.ts       // ~200 líneas
│   ├── smoothing.service.ts        // ~150 líneas
│   ├── metrics.service.ts          // ~150 líneas
│   ├── deviation-detection.service.ts // ~200 líneas
│   ├── muting.service.ts           // ~100 líneas
│   └── gaze-tracking.facade.service.ts // ~150 líneas (coordinador)
```

**Archivos de referencia:**
- `docs/GAZE-REFACTOR-PLAN.md`
- `docs/GAZE-IMPLEMENTATION-CHECKLIST.md`
- `docs/GAZE-DATAFLOW-DIAGRAM.md`

**Estimación:** 5-7 días (refactor + tests)

---

### 2. Integración Backend-Chaindrenciales Incompleta

**Problema:**
El frontend espera endpoints documentados pero la integración real fallaría:

| Endpoint | Frontend | Backend Chaindrencials | Estado |
|----------|----------|------------------------|--------|
| `GET /api/evaluaciones/:id/susie-config` | Listo | Parcial | Config incompleta |
| `POST /api/evaluaciones/:id/resultados` | Listo | NO existe | FALTA |

**Columnas faltantes en BD Chaindrenciales:**
- `evaluaciones.susie_status` (ENUM: 'clean', 'flagged', 'cancelled')
- `evaluaciones.susie_report_id` (VARCHAR)
- `evaluaciones.duracion_minutos` (INT)

**Estimación:** 2-3 días

---

## 🟠 IMPORTANTE — Degradan UX

### 3. GazeTrackingService Refactor

**Estado:** Documentado en 3 archivos, SIN ejecutar

**Fases planificadas:**
```
Fase 0: Extracción de interfaces ━━━━━━━━━━━━━ TODO
Fase 1: CalibrationService ━━━━━━━━━━━━━━━━━━━ TODO
Fase 2: PredictionService ━━━━━━━━━━━━━━━━━━━ TODO
Fase 3: SmoothingService ━━━━━━━━━━━━━━━━━━ TODO
Fase 4: MetricsService ━━━━━━━━━━━━━━━━━━━ TODO
Fase 5: DeviationDetectionService ━━━━━━━━━ TODO
Fase 6: MutingService ━━━━━━━━━━━━━━━━━━━ TODO
Fase 7: FacadeService ━━━━━━━━━━━━━━━━━━━ TODO
Fase 8: Cleanup y deprecation ━━━━━━━━━━━ TODO
```

**Estimación:** 3-4 semanas

---

### 4. Environment Check Avanzado

**Archivo:** `frontend/projects/ngx-susie-proctoring/src/lib/components/environment-check/`

**Estado actual:** Básico (verifica permisos)

**Falta implementar:**
- [ ] Verificación de iluminación (análisis de brillo del canvas)
- [ ] Detección de presencia de cara antes de empezar
- [ ] Audio level check (¿micrófono capta correctamente?)
- [ ] Verificación de conexión estable

**Ejemplo de implementación faltante:**
```typescript
// environment-check.component.ts
async checkLighting(): Promise<LightingResult> {
  // Analizar brillo promedio del canvas
  // Si < threshold → advertir "iluminación insuficiente"
}

async checkFacePresence(): Promise<boolean> {
  // Usar MediaPipe FaceDetector
  // Si no hay cara → "Posiciónate frente a la cámara"
}

async checkAudioLevel(): Promise<AudioLevelResult> {
  // Analizar RMS del micrófono por 3 segundos
  // Si < threshold → "El micrófono no capta audio"
}
```

**Estimación:** 4-6 horas

---

### 5. Session Recovery (RNF-009)

**Problema:**
Si el usuario cierra el navegador o pierde conexión, pierde todo el progreso.

**Documentado en:** `FLUJO_COMPLETO_SUSIE.md`

**Falta implementar:**
- [ ] Persistir respuestas en IndexedDB cada N segundos
- [ ] Detectar sesión previa al cargar
- [ ] Ofrecer "Continuar donde dejaste" o "Empezar de nuevo"
- [ ] Limpiar datos al finalizar examen

**Estimación:** 4-6 horas

---

### 6. Offline Badge Visual

**Estado:** Parcialmente implementado

**Existe:**
- `EvidenceQueueService` con IndexedDB
- `offline-badge` en el HTML

**Falta:**
- [ ] Integración completa con `getPendingCount()`
- [ ] Actualización en tiempo real
- [ ] Animación de "sincronizando"

**Estimación:** 2-3 horas

---

### 7. Dashboard de Estado (NO existe)

**Documentado en:** `FLUJO_COMPLETO_SUSIE.md`

**Debería mostrar:**
- Estado de cámara (activo/error)
- Estado de micrófono (activo/error)
- Conexión WebSocket (conectado/desconectado)
- Estado de red (online/offline)
- Violaciones acumuladas (contador)
- Evidencias pendientes de envío

**Estimación:** 3-4 horas

---

## 🟡 MENOR — Polish y mantenibilidad

### 8. Tests de Componentes Faltantes

**Archivos sin `.spec.ts`:**

| Componente | Tests necesarios |
|------------|------------------|
| `GazeCalibrationComponent` | Flujo de calibración MediaPipe |
| `GazeDeviationAlertComponent` | Mostrar/ocultar alertas |
| `FaceLossCountdownComponent` | Countdown y cancelación |
| `CameraPipComponent` | Renderizado de video |
| `ExamBriefingComponent` | Instrucciones y botones |
| `StepIndicatorComponent` | Navegación de pasos |

**Estimación:** 6-8 horas

---

### 9. Accesibilidad (a11y) Parcial

**Estado actual:**
- `aria-label`, `role`, `aria-live` presentes en mayoría
- Focus trap en modales

**Falta:**
- [ ] Navegación por teclado completa (Tab order)
- [ ] Contraste de colores verificado (WCAG AA)
- [ ] Focus management al cambiar de estado
- [ ] Screen reader announcements para alertas
- [ ] Skip links para navegación

**Estimación:** 4-6 horas

---

### 10. Internacionalización (i18n) AUSENTE

**Problema:**
Todos los textos están hardcodeados en español.

**Ejemplo:**
```typescript
// Actual
title = 'Verificación de identidad';

// Debería ser
title = this.i18n.get('biometric.title');
```

**Falta:**
- [ ] Extraer textos a archivos de traducción
- [ ] Implementar `I18nService`
- [ ] Soporte mínimo es/en
- [ ] Detección de idioma del navegador

**Estimación:** 6-8 horas

---

### 11. Performance Monitoring AUSENTE

**No se trackean:**
- Uso de memoria durante captura
- Frames dropeados en video
- Latencia de uploads
- Tiempo de calibraciónMediaPipe

**Implementación propuesta:**
```typescript
// performance-metrics.service.ts
interface PerformanceMetrics {
  memoryUsage: number;        // MB
  framesDropped: number;      // count
  uploadLatencyMs: number;    // ms
  calibrationTimeMs: number;  // ms
}
```

**Estimación:** 3-4 horas

---

## 📋 Priorización Sugerida

### Sprint 1 (Crítico)
| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| Tests GazeTrackingService | 2-3 días | 🔴 CRÍTICO |
| GazeTracking Refactor - Fases 0-2 | 1 semana | 🔴 CRÍTICO |

### Sprint 2 (Importante)
| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| Session Recovery | 4-6 hs | 🟠 IMPORTANTE |
| Environment Check avanzado | 4-6 hs | 🟠 IMPORTANTE |
| Offline Badge integración | 2-3 hs | 🟠 IMPORTANTE |

### Sprint 3 (Polish)
| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| Tests de componentes | 6-8 hs | 🟡 MENOR |
| Accesibilidad | 4-6 hs | 🟡 MENOR |
| Dashboard de estado | 3-4 hs | 🟡 MENOR |

### Backlog
| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| Internacionalización (i18n) | 6-8 hs | 🟡 MENOR |
| Performance Monitoring | 3-4 hs | 🟡 MENOR |

---

## 🔗 Archivos Relacionados

- `TAREAS_FRONTEND_PENDIENTES.md` — Tareas pendientes generales
- `ROADMAP_TAREAS.md` — Roadmap de implementación
- `FLUJO_COMPLETO_SUSIE.md` — Flujo documentado completo
- `PRD_SUSIE.md` — Requerimientos funcionales

---

## 📝 Notas Técnicas

### GazeTrackingService — Análisis de deuda técnica

```typescript
// Archivo actual: 1157 líneas
// Responsabilidades detectadas:

// 1. Calibración (líneas 1-200)
// - Manejo de puntos de calibración
// - Cálculo de coeficientes
// - Storage de datos de calibración

// 2. Predicción (líneas 201-400)
// - Predicción de coordenadas X/Y
// - Interpolación entre puntos
// - Manejo de outliers

// 3. Suavizado (líneas 401-550)
// - Filtro Kalman o similar
// - Suavizado de trayectoria

// 4. Métricas (líneas 551-700)
// - Cálculo de desviación acumulada
// - Tiempo fuera de zona

// 5. Detección (líneas 701-900)
// - Comparación con umbrales
// - Generación de alertas

// 6. Muting (líneas 901-1157)
// - Supresión de eventos durante scroll
// - Cooldown entre alertas
// - Batch de eventos
```

**Recomendación:** Refactor incremental manteniendo backward compatibility durante transición.

---

> **Última actualización:** 16 Marzo 2026
> **Próxima revisión:** Después de completar Sprint 1