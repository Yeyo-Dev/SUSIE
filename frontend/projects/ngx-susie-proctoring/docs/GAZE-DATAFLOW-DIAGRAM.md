# GazeTrackingService - Flujo de Datos & Diagrama de Orquestación

## DIAGRAMA COMPLETO DEL FLUJO

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      FASE 1: CALIBRACIÓN                                       ║
╚═══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────┐
│   Usuario: startCalibration  │
│   (existingStream?)          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  GazeTrackingFacade.startCalibration()          │
│  └─ gazeState.set('CALIBRATING')                │
│  └─ delegate to: GazeCalibrationService         │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  GazeCalibrationService                                         │
│                                                                  │
│  1. Get window.webgazer (global)                                │
│  2. if existingStream:                                          │
│     └─ monkey-patch navigator.mediaDevices.getUserMedia        │
│  3. webgazer.setTracker('TFFacemesh')                          │
│  4. webgazer.setRegression('ridge')                            │
│  5. webgazer.setGazeListener(callback)                         │
│     └─ callback → GazePredictionService (listener mode) [HOLD] │
│  6. await webgazer.begin()                                      │
│  7. restore getUserMedia                                        │
│  8. showVideoPreview(true).showPredictionPoints(true)           │
│  9. MutingService.startMuting()                                │
│  10. emit calibrationCompleted$                                 │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├─→ GazeWebGazerMutingService.startMuting()
               │    ├─ startAggressiveMuting()
               │    └─ muteAllWebgazerVideos()
               │
               └─→ Facade receives calibrationCompleted$
                   └─ gazeState.set('TRACKING')
                   └─ recordCalibrationClick() → GazeCalibrationService.recordCalibrationClick()
                      (Usuario hace click en puntos de calibración)


╔═══════════════════════════════════════════════════════════════════════════════╗
║                      FASE 2: TRANSICIÓN A TRACKING                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────┐
│   Usuario: completeCalibration │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  GazeTrackingFacade.completeCalibration()   │
│  └─ delegate to:                            │
│     • GazeCalibrationService.complete()     │
│     • GazePredictionService.startTracking() │
│     • GazeDeviationService.startMonitoring()│
└──────────────┬───────────────────────────────┘
               │
               ├─→ GazeCalibrationService.completeCalibration()
               │    ├─ isCalibrated.set(true) [signal]
               │    ├─ gazeState.set('TRACKING')
               │    ├─ clear xHistory, yHistory, gazeBuffer
               │    └─ webgazer.resume() [si disponible]
               │
               ├─→ GazePredictionService.startTracking(webgazer)
               │    ├─ Setea listener (ya configurado en calibración)
               │    ├─ startManualPolling()
               │    │    └─ RAF loop → webgazer.getCurrentPrediction()
               │    │        └─ predictionReceived$.emit(data)
               │    └─ tracking activo en PARALELO:
               │        • setGazeListener callbacks (si llegan)
               │        • polling manual (fallback)
               │
               └─→ GazeDeviationService.startMonitoring()
                    └─ setInterval 1s → evalúa puntos


╔═══════════════════════════════════════════════════════════════════════════════╗
║                      FASE 3: TRACKING EN TIEMPO REAL                           ║
║                        (El flujo crítico)                                      ║
╚═══════════════════════════════════════════════════════════════════════════════╝

FUENTES DE DATOS (EN PARALELO):

Fuente A: WebGazer setGazeListener callback
───────────────────────────────────────────

GazePredictionService
├─ setGazeListener(callback)
├─ callback(data: WebGazerPrediction, _clock)
│  └─ if data:
│     ├─ gazeFrameCount++
│     └─ predictionReceived$.emit({ x, y, ts })
└─ → siguiente

Fuente B: WebGazer.getCurrentPrediction() polling (RAF)
───────────────────────────────────────────────────────

GazePredictionService.startManualPolling()
├─ requestAnimationFrame(poll)
├─ cada 100ms:
│  ├─ if webgazer.getCurrentPrediction():
│  │  ├─ gazeFrameCount++
│  │  └─ predictionReceived$.emit({ x, y, ts })
│  └─ schedule siguiente
└─ continua hasta stopTracking()


PROCESAMIENTO DE DATOS:

Ambas fuentes → GazePredictionService.predictionReceived$
                    │
                    │ (Observable stream)
                    ▼
┌────────────────────────────────────────────────────────┐
│  GazeTrackingFacade (orquestador)                      │
│                                                        │
│  subscribe to predictionReceived$:                    │
│  ├─ map(raw → GazeSmoothingService.smoothAndNormalize)│
│  │   │ Entrada: pixels (x: 0-1920, y: 0-1080)        │
│  │   │ Salida: GazePoint { x: -1..1, y: -1..1, ts }  │
│  │   └─ emite pointSmoothed$                          │
│  │                                                    │
│  ├─ tap → ngZone.run(() => lastPoint.set(point))    │
│  │   [Signal reactiva para UI]                       │
│  │                                                    │
│  ├─ tap → GazeMetricsService.recordPoint(point)      │
│  │   └─ gazeBuffer.push(point) [telemetría]          │
│  │                                                    │
│  └─ tap → GazeDeviationService.evaluatePoint(point)  │
│      └─ verifica si x,y exceden umbral               │
│         └─ si >= deviationToleranceSeconds:          │
│            ├─ deviationDetected$.emit()              │
│            └─ hasDeviation.set(true)                 │
│               └─ deviationCallback?.()               │
│                                                        │
└────────────────────────────────────────────────────────┘


FLUJO RESUMIDO:

┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  WebGazer (raw frames)                                           │
│  ├─ Listener: frame → predictionReceived$                       │
│  └─ Polling: getCurrentPrediction() → predictionReceived$       │
│                                                                  │
│        │                                                         │
│        ▼                                                         │
│  ┌──────────────────────────────┐                               │
│  │  GazeSmoothingService        │                               │
│  │  ├─ xHistory[], yHistory[]   │                               │
│  │  └─ smoothAndNormalize()     │                               │
│  │     ├─ escala píxel → [-1,1] │                               │
│  │     └─ promedia ventana      │                               │
│  └──────────┬───────────────────┘                               │
│             │ GazePoint                                         │
│             ├─→ lastPoint.set() [signal]                       │
│             ├─→ MetricsService.recordPoint() [buffer]          │
│             └─→ DeviationService.evaluatePoint() [threshold]   │
│                                                                  │
│  ┌──────────────────────────────┐   ┌───────────────────────┐  │
│  │  GazeMetricsService          │   │ GazeDeviationService  │  │
│  ├─ gazeBuffer[]                │   ├─ deviationStartTime   │  │
│  └─ recordPoint()               │   └─ evaluatePoint()      │  │
│     └─ push if intervalo >= Δt  │      └─ if duration >= Τ: │  │
│                                 │         ├─ hasDeviation=1  │  │
│                                 │         └─ callback?()     │  │
│  flushGazeBuffer() ← Usuario    │       (polling 1s)        │  │
│                                 │                            │  │
│  getGazeBuffer()  ← Usuario     │ deviationDetected$        │  │
│                                 │   (Observable)            │  │
│                                 │                            │  │
└─────────────────────────────────┴────────────────────────────┘ │
                                                                  │
└──────────────────────────────────────────────────────────────────┘


╔═══════════════════════════════════════════════════════════════════════════════╗
║                      FASE 4: DETENCIÓN (stop)                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────┐
│  Usuario: stop()             │
└───────────┬──────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────┐
│  GazeTrackingFacade.stop()                       │
└───────────┬────────────────────────────────────┬─┘
            │                                    │
            ├─→ GazePredictionService.stopTracking()
            │    ├─ webgazer?.end()
            │    ├─ cancelAnimationFrame(pollingRafId)
            │    └─ complete() suscriptores
            │
            ├─→ GazeDeviationService.stopMonitoring()
            │    ├─ clearInterval()
            │    └─ complete() suscriptores
            │
            ├─→ GazeWebGazerMutingService.stopMuting()
            │    ├─ muteObserver?.disconnect()
            │    └─ clearInterval(muteRetryInterval)
            │
            └─→ Limpieza de estado local:
                 ├─ gazeState.set('IDLE')
                 ├─ isCalibrated.set(false)
                 ├─ hasDeviation.set(false)
                 ├─ lastPoint.set(null)
                 ├─ webgazer = null
                 └─ xHistory[], yHistory[], gazeBuffer[] = []
```

---

## DEPENDENCY GRAPH (SIN CICLOS)

```
GazeTrackingFacade (Orquestador)
│
├─► (inject) GazeCalibrationService
│   └─ injects: NgZone, DestroyRefUtility
│
├─► (inject) GazePredictionService
│   └─ injects: NgZone, DestroyRefUtility
│
├─► (inject) GazeSmoothingService
│   └─ no injects (puro)
│
├─► (inject) GazeMetricsService
│   └─ no injects (puro)
│
├─► (inject) GazeDeviationDetectionService
│   └─ injects: DestroyRefUtility
│
└─► (inject) GazeWebGazerMutingService
    └─ injects: DestroyRefUtility


Observable Streams (NO inyección):

GazePredictionService.predictionReceived$
    ↓ (consumed by)
    GazeTrackingFacade
    └─ pipes to:
       ├─ GazeSmoothingService (stateless transform)
       ├─ GazeMetricsService (suscribe)
       └─ GazeDeviationService (suscribe)

GazeDeviationService.deviationDetected$
    ↓ (consumed by)
    GazeTrackingFacade
    └─ hasDeviation.set(true)
       └─ deviationCallback?.()


Ciclos: CERO ✅
Inyección circular: NO EXISTE ✅
```

---

## ESTADO POR SERVICIO

```
GazeCalibrationService
├─ isCalibrated: boolean
├─ gazeFrameCount: number (initial)
├─ webgazer: WebGazerAPI | null
└─ calibrationData: { points, startedAt }

GazePredictionService
├─ isTracking: boolean
├─ webgazer: WebGazerAPI
├─ gazeFrameCount: number
├─ pollingRafId: number | null
├─ lastPollTime: number
└─ deviationCallback: () => void (relay from Facade)

GazeSmoothingService
├─ xHistory: number[]
├─ yHistory: number[]
└─ config: GazeConfig

GazeMetricsService
├─ gazeBuffer: GazePoint[]
├─ maxBufferSize: number
└─ stats: { count, minX, maxX, ... } (opcional)

GazeDeviationDetectionService
├─ isDeviated: boolean
├─ deviationStartTime: number | null
├─ checkInterval: IntervalHandle
└─ config: GazeConfig

GazeWebGazerMutingService
├─ muteObserver: MutationObserver | null
└─ muteRetryInterval: IntervalHandle | undefined

GazeTrackingFacade (public)
├─ gazeState: Signal<GazeState>
├─ isCalibrated: Signal<boolean>
├─ lastPoint: Signal<GazePoint | null>
└─ hasDeviation: Signal<boolean>
```

---

## MATEMÁTICA DE SUAVIZADO

```typescript
// ENTRADA: raw pixel coordinates
rawX: 1234  // 0..innerWidth
rawY: 567   // 0..innerHeight

// PASO 1: Normalizar a [-1, 1]
scaledX = (rawX / width) * 2 - 1
scaledY = (rawY / height) * 2 - 1
// Resultado: scaledX ∈ [-1, 1], scaledY ∈ [-1, 1]
// (0, 0) = centro, (-1, -1) = arriba-izquierda, (1, 1) = abajo-derecha

// PASO 2: Ventana deslizante (moving average)
xHistory.push(scaledX)          // Agregar nuevo
if (xHistory.length > window) {
  xHistory.shift()              // Eliminar si >= ventana
}

avgX = sum(xHistory) / length   // Promedio
// Resultado: suavizado contra ruido

// PASO 3: Precisión
avgX = parseFloat(avgX.toFixed(3))  // 3 decimales
// Resultado: GazePoint { x, y, ts }
```

---

## UMBRAL DE DESVIACIÓN

```typescript
// Punto suavizado
const point: GazePoint = { x: 0.92, y: 0.88, ts: ... }

// Evaluación
isOutOfBounds = Math.abs(point.x) > THRESHOLD (0.85)
             || Math.abs(point.y) > THRESHOLD (0.85)
// Resultado: true (0.92 > 0.85, fuera de pantalla)

// Acumulación
if (isOutOfBounds && !deviationStartTime) {
  deviationStartTime = now
}
elapsed = (now - deviationStartTime) / 1000

if (elapsed >= TOLERANCE_SECONDS (5) && !hasDeviation) {
  hasDeviation = true
  emit deviationDetected$
  callback?()
}

// Recuperación
else if (!isOutOfBounds && deviationStartTime) {
  deviationStartTime = null
  if (hasDeviation) {
    hasDeviation = false
    emit deviationResolved$
  }
}
```

---

## CONFIGURACIÓN

```typescript
interface GazeConfig {
  smoothingWindow: number;           // 10 frames (ventana promedio)
  deviationThreshold: number;        // 0.85 (escala [-1,1])
  deviationToleranceSeconds: number; // 5 (segundos sostenidos)
  samplingIntervalMs: number;        // 1000 (ms entre muestras buffer)
}

const DEFAULT_CONFIG = {
  smoothingWindow: 10,
  deviationThreshold: 0.85,
  deviationToleranceSeconds: 5,
  samplingIntervalMs: 1000,
}
```

---

## CICLO DE VIDA COMPLETO

```
┌───────────────────────────────────────────────────────────────┐
│  1. INIT (aplicación cargada)                                 │
├───────────────────────────────────────────────────────────────┤
│  GazeTrackingFacade instanciado (providedIn: root)           │
│  - Sub-servicios inyectados pero NO activos                   │
│  - Signals creados: IDLE, notCalibrated, lastPoint=null      │
│                                                                │
│  2. CONFIGURE (usuario establece callbacks)                  │
├───────────────────────────────────────────────────────────────┤
│  configure(config, logger, onDeviation)                       │
│  - Propagar config a todos los servicios                      │
│  - Guardar logger y onDeviation callbacks                     │
│                                                                │
│  3. START CALIBRATION                                        │
├───────────────────────────────────────────────────────────────┤
│  startCalibration(existingStream?)                           │
│  └─ GazeCalibrationService.startCalibration()                │
│     ├─ WebGazer.begin()                                      │
│     ├─ setGazeListener(callback) → Prediction service       │
│     └─ MutingService.startMuting()                          │
│  └─ UI muestra puntos rojos, usuario hace clic               │
│  └─ recordCalibrationClick() → log (WebGazer aprende)       │
│                                                                │
│  4. COMPLETE CALIBRATION → START TRACKING                   │
├───────────────────────────────────────────────────────────────┤
│  completeCalibration()                                        │
│  ├─ PredictionService.startTracking(webgazer)               │
│  │  └─ Listener activo + polling RAF simultáneamente        │
│  ├─ DeviationService.startMonitoring()                      │
│  │  └─ Polling cada 1s                                      │
│  └─ gazeState → TRACKING                                     │
│                                                                │
│  5. TRACKING ACTIVO (indefinido)                            │
├───────────────────────────────────────────────────────────────┤
│  Flujo de datos continuo:                                     │
│  WebGazer → predictionReceived$ → smoothing → signals       │
│           → metrics (buffer) → deviation check               │
│                                                                │
│  Usuario puede:                                               │
│  - getGazeBuffer() (lectura)                                 │
│  - flushGazeBuffer() (lectura + reset)                      │
│  - Recibir hasDeviation signal                               │
│  - Recibir onDeviation callback                              │
│                                                                │
│  6. STOP (usuario detiene)                                  │
├───────────────────────────────────────────────────────────────┤
│  stop()                                                        │
│  ├─ PredictionService.stopTracking()                         │
│  │  ├─ webgazer.end()                                        │
│  │  └─ cancelAnimationFrame()                                │
│  ├─ DeviationService.stopMonitoring()                        │
│  │  └─ clearInterval()                                       │
│  ├─ MutingService.stopMuting()                               │
│  │  ├─ observer.disconnect()                                 │
│  │  └─ clearInterval()                                       │
│  └─ Limpieza: gazeState → IDLE, signals → defaults           │
│                                                                │
│  7. CLEANUP (aplicación destruida)                           │
├───────────────────────────────────────────────────────────────┤
│  Angular destroyRef limpia todos los intervalos/observers    │
│  (DestroyRefUtility maneja automáticamente)                   │
└───────────────────────────────────────────────────────────────┘
```

---

## MANEJO DE ERRORES

```typescript
// GazeCalibrationService
if (!window.webgazer) {
  ├─ logger('error', 'WebGazer no está cargado')
  └─ gazeState.set('ERROR')
  └─ return false

// GazePredictionService
try {
  prediction = webgazer.getCurrentPrediction()
} catch (e) {
  ├─ if (gazeFrameCount % 100 === 0) {
  │   logger('error', 'Error en polling de gaze')
  │ }
  └─ continue (no crash)

// GazeTrackingFacade.stop()
try {
  webgazer.end()
} catch {
  // WebGazer puede fallar si ya fue destruido
  // Ignorar gracefully
}
```

---

**Generado**: 2026-03-11  
**Última actualización**: Coincide con GAZE-REFACTOR-PLAN.md
