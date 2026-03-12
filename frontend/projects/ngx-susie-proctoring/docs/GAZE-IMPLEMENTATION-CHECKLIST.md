# GazeTrackingService Refactor - Implementation Checklist

## FASE 0: PREPARACIÓN (PRE-IMPLEMENTATION)

### 0.1 Planning & Validation
- [ ] Revisar GAZE-REFACTOR-PLAN.md completo con el equipo
- [ ] Revisar GAZE-DATAFLOW-DIAGRAM.md (validar flujo de datos)
- [ ] Aprobación de arquitectura por lead técnico
- [ ] Identificar blockers / dependencias externas
- [ ] Crear rama: `feature/gaze-refactor-descomposicion`

### 0.2 Setup Inicial
- [ ] Crear directorio: `src/lib/services/gaze/`
- [ ] Crear directorio: `src/lib/services/gaze/__tests__/`
- [ ] Crear `src/lib/services/gaze/index.ts` (barrel export)
- [ ] Crear archivos STUB de servicios (vacíos)
  - [ ] `gaze-calibration.service.ts` (stub)
  - [ ] `gaze-prediction.service.ts` (stub)
  - [ ] `gaze-smoothing.service.ts` (stub)
  - [ ] `gaze-metrics.service.ts` (stub)
  - [ ] `gaze-deviation-detection.service.ts` (stub)
  - [ ] `gaze-webgazer-muting.service.ts` (stub)

### 0.3 Backup & Safety
- [ ] Hacer commit con servicio original: `[backup] GazeTrackingService antes de refactor`
- [ ] Crear tag: `gaze-refactor-start`
- [ ] Documentar rollback plan en README.md
- [ ] Setup pre-commit hooks (lint, type-check)

### 0.4 Tests Preparación
- [ ] Instalar/verificar jest/testing-library
- [ ] Crear shared test utilities (mocks de WebGazer)
- [ ] Crear `__tests__/mocks/webgazer.mock.ts`
- [ ] Setup coverage thresholds en jest.config.js
- [ ] Verify test runner: `npm test:gaze`

---

## FASE 1: EXTRACCIÓN GazeCalibrationService

### 1.1 Implementación Base
- [ ] Crear: `src/lib/services/gaze/gaze-calibration.service.ts`
- [ ] Definir interfaz:
  ```typescript
  async startCalibration(existingStream?: MediaStream): Promise<boolean>
  recordCalibrationClick(screenX: number, screenY: number): void
  completeCalibration(): Promise<void>
  resetCalibration(): void
  ```
- [ ] Extraer del original (líneas 104-194):
  - [ ] `startCalibration()` completo
  - [ ] `recordCalibrationClick()` completo
  - [ ] `completeCalibration()` (excepto orquestación)
- [ ] Estado interno:
  - [ ] `isCalibrated: boolean`
  - [ ] `gazeFrameCount: number`
  - [ ] `webgazer: WebGazerAPI | null`
  - [ ] `calibrationData: { points: Point[], startedAt: number }`

### 1.2 Inyecciones y Config
- [ ] Inyectar: `NgZone`, `DestroyRefUtility`, `GazeConfig`
- [ ] Inyectar logger: `LoggerFn`
- [ ] Crear método: `configure(config: GazeConfig, logger?: LoggerFn)`
- [ ] @Injectable({ providedIn: 'root' })

### 1.3 Eventos (Observables)
- [ ] Crear: `calibrationStarted$ = new Subject<void>()`
- [ ] Crear: `calibrationProgress$ = new Subject<{ frames: number }>()`
- [ ] Crear: `calibrationCompleted$ = new Subject<boolean>()`
- [ ] Crear: `calibrationError$ = new Subject<Error>()`
- [ ] Emitir en momentos clave

### 1.4 Tests Unitarios
- [ ] Tests/mocks para GazeCalibrationService:
  - [ ] Test: `startCalibration() con existingStream`
  - [ ] Test: `startCalibration() sin stream`
  - [ ] Test: `startCalibration() maneja error WebGazer no cargado`
  - [ ] Test: `completeCalibration() emite event`
  - [ ] Test: `recordCalibrationClick() loguea`
  - [ ] Test: `resetCalibration() limpia estado`
- [ ] Target coverage: 80%+

### 1.5 Integración en Facade
- [ ] Inyectar `GazeCalibrationService` en `GazeTrackingFacade`
- [ ] Delegación: `startCalibration()` → `service.startCalibration()`
- [ ] Delegación: `recordCalibrationClick()` → `service.recordCalibrationClick()`
- [ ] Suscribir a `calibrationCompleted$` → actualizar signals

### 1.6 Validación
- [ ] npm test (GazeCalibrationService tests pass)
- [ ] npm run lint
- [ ] npm run type-check
- [ ] Commit: `feat(gaze): extract GazeCalibrationService`

---

## FASE 2: EXTRACCIÓN GazePredictionService

### 2.1 Implementación Base
- [ ] Crear: `src/lib/services/gaze/gaze-prediction.service.ts`
- [ ] Definir interfaz:
  ```typescript
  async startTracking(webgazer: WebGazerAPI): Promise<void>
  stopTracking(): void
  setGazeListener(callback?: (data: WebGazerPrediction) => void): void
  startManualPolling(): void
  stopManualPolling(): void
  ```
- [ ] Extraer del original (líneas 528-589):
  - [ ] `startManualPolling()` completo
  - [ ] `stopManualPolling()` completo
  - [ ] `setGazeListener()` setup (del callback de setGazeListener)

### 2.2 Estado Interno
- [ ] `isTracking: boolean`
- [ ] `webgazer: WebGazerAPI | null`
- [ ] `gazeFrameCount: number`
- [ ] `pollingRafId: number | null`
- [ ] `lastPollTime: number`
- [ ] `deviationCallback?: () => void` (relay de Facade)

### 2.3 Eventos (Observables)
- [ ] Crear: `predictionReceived$ = new Subject<RawGazeData>()`
  - [ ] Interfaz: `{ x: number, y: number, ts: number }`
- [ ] Crear: `trackingStarted$ = new Subject<void>()`
- [ ] Crear: `trackingStopped$ = new Subject<void>()`
- [ ] Crear: `trackingError$ = new Subject<Error>()`
- [ ] Emitir en momentos clave

### 2.4 Integración con Calibration
- [ ] `startTracking()` recibe `webgazer: WebGazerAPI`
- [ ] Setea el listener que Calibration configuró
- [ ] Inicia polling manual como fallback
- [ ] Ambas fuentes emiten a `predictionReceived$`

### 2.5 Tests Unitarios
- [ ] Tests/mocks para GazePredictionService:
  - [ ] Test: `startTracking()` configura listener
  - [ ] Test: `startTracking()` inicia RAF polling
  - [ ] Test: `stopTracking()` cancela RAF
  - [ ] Test: `stopTracking()` llama webgazer.end()`
  - [ ] Test: listener callback emite predictionReceived$
  - [ ] Test: polling emite predictionReceived$
  - [ ] Test: throttling de polling a 100ms
- [ ] Mock RAF (jest.useFakeTimers())
- [ ] Target coverage: 80%+

### 2.6 Integración en Facade
- [ ] Inyectar `GazePredictionService` en Facade
- [ ] Delegación: `completeCalibration()` → `service.startTracking(webgazer)`
- [ ] Suscribir a `predictionReceived$` → pipeline de smoothing
- [ ] Relay `deviationCallback` si es necesario

### 2.7 Validación
- [ ] npm test (GazePredictionService tests pass)
- [ ] npm run lint
- [ ] npm run type-check
- [ ] Commit: `feat(gaze): extract GazePredictionService`

---

## FASE 3: EXTRACCIÓN GazeSmoothingService

### 3.1 Implementación Base
- [ ] Crear: `src/lib/services/gaze/gaze-smoothing.service.ts`
- [ ] Definir interfaz:
  ```typescript
  smoothAndNormalize(rawX: number, rawY: number): GazePoint
  reset(): void
  setSmootingWindow(size: number): void
  ```
- [ ] Extraer del original (líneas 309-363):
  - [ ] Matemática de normalización (píxel → [-1,1])
  - [ ] Lógica de ventana deslizante (xHistory, yHistory)
  - [ ] Promediado

### 3.2 Estado Interno
- [ ] `xHistory: number[] = []`
- [ ] `yHistory: number[] = []`
- [ ] `config: GazeConfig` (para smoothingWindow)

### 3.3 Métodos
- [ ] `smoothAndNormalize(rawX: number, rawY: number): GazePoint`
  - [ ] Entrada: píxeles (0..window.innerWidth)
  - [ ] Escalar a [-1, 1]
  - [ ] Agregar a history
  - [ ] Calcular promedio
  - [ ] Retornar GazePoint
- [ ] `reset(): void`
  - [ ] Limpiar xHistory, yHistory
- [ ] `setSmootingWindow(size: number): void`
  - [ ] Actualizar config.smoothingWindow

### 3.4 Tests Unitarios
- [ ] Tests/specs para GazeSmoothingService:
  - [ ] Test: `smoothAndNormalize()` escala correctamente
    - [ ] Pixel (960, 540) → ~(0, 0) [centro]
    - [ ] Pixel (0, 0) → (-1, -1) [arriba-izq]
    - [ ] Pixel (1920, 1080) → (1, 1) [abajo-der]
  - [ ] Test: suavizado con ventana 10
    - [ ] 5 frames → promedia los 5
    - [ ] 15 frames → promedia últimos 10
  - [ ] Test: precisión a 3 decimales
  - [ ] Test: `reset()` limpia history
  - [ ] Test: `setSmootingWindow()` actualiza tamaño
- [ ] 100% determinista (no hay random, no hay asyncs)
- [ ] Target coverage: 100% (es puro)
- [ ] Snapshot tests para outputs

### 3.5 Integración en Facade
- [ ] Inyectar `GazeSmoothingService` en Facade
- [ ] Pipeline:
  ```
  predictionReceived$ 
    → map(raw → smoothing.smoothAndNormalize(raw.x, raw.y))
    → [siguientes pasos]
  ```

### 3.6 Validación
- [ ] npm test (GazeSmoothingService tests pass)
- [ ] npm run lint
- [ ] npm run type-check
- [ ] Commit: `feat(gaze): extract GazeSmoothingService`

---

## FASE 4: EXTRACCIÓN GazeMetricsService

### 4.1 Implementación Base
- [ ] Crear: `src/lib/services/gaze/gaze-metrics.service.ts`
- [ ] Definir interfaz:
  ```typescript
  recordPoint(point: GazePoint): void
  getMetrics(): GazeMetrics
  flushBuffer(): GazePoint[]
  getBuffer(): GazePoint[]
  reset(): void
  ```

### 4.2 Estado Interno
- [ ] `gazeBuffer: GazePoint[] = []`
- [ ] `maxBufferSize: number = 60`
- [ ] `config: GazeConfig` (para samplingIntervalMs)
- [ ] `stats?: { count: number, minX: number, maxX: number, ... }` (opcional)

### 4.3 Métodos
- [ ] `recordPoint(point: GazePoint): void`
  - [ ] Si gazeBuffer vacío o elapsed >= samplingIntervalMs
  - [ ] Push a buffer
  - [ ] Trim si > maxBufferSize
- [ ] `flushBuffer(): GazePoint[]`
  - [ ] Return copy of buffer
  - [ ] Clear buffer
  - [ ] (para telemetría/snapshots)
- [ ] `getBuffer(): GazePoint[]`
  - [ ] Return copy of buffer (sin modificar)
- [ ] `reset(): void`
  - [ ] Limpiar buffer

### 4.4 Integración con Smoothing
- [ ] Suscribir a `smoothingService.pointSmoothed$`
- [ ] Llamar `recordPoint()` en cada emit

### 4.5 Tests Unitarios
- [ ] Tests para GazeMetricsService:
  - [ ] Test: `recordPoint()` agrega a buffer
  - [ ] Test: `recordPoint()` respeta intervalo samplingIntervalMs
  - [ ] Test: `recordPoint()` trimea si > maxBufferSize
  - [ ] Test: `flushBuffer()` devuelve y limpia
  - [ ] Test: `getBuffer()` devuelve sin modificar
  - [ ] Test: `reset()` limpia todo
- [ ] Target coverage: 85%+

### 4.6 Integración en Facade
- [ ] Inyectar `GazeMetricsService` en Facade
- [ ] Suscribir a pipeline:
  ```
  smoothing.pointSmoothed$
    → tap(point => metricsService.recordPoint(point))
  ```

### 4.7 Validación
- [ ] npm test (GazeMetricsService tests pass)
- [ ] npm run lint
- [ ] npm run type-check
- [ ] Commit: `feat(gaze): extract GazeMetricsService`

---

## FASE 5: EXTRACCIÓN GazeDeviationDetectionService

### 5.1 Implementación Base
- [ ] Crear: `src/lib/services/gaze/gaze-deviation-detection.service.ts`
- [ ] Definir interfaz:
  ```typescript
  startMonitoring(): void
  stopMonitoring(): void
  evaluatePoint(point: GazePoint): void
  getDeviationStatus(): boolean
  reset(): void
  ```

### 5.2 Estado Interno
- [ ] `isDeviated: boolean = false`
- [ ] `deviationStartTime: number | null = null`
- [ ] `checkInterval: IntervalHandle | undefined`
- [ ] `config: GazeConfig` (para threshold, toleranceSeconds)

### 5.3 Métodos
- [ ] `startMonitoring(): void`
  - [ ] setInterval cada 1s
  - [ ] Evaluar currentPoint vs threshold
  - [ ] Acumular tiempo si está fuera
- [ ] `stopMonitoring(): void`
  - [ ] clearInterval()
- [ ] `evaluatePoint(point: GazePoint): void`
  - [ ] Guardar punto para siguiente check
- [ ] `getDeviationStatus(): boolean`
  - [ ] Return isDeviated

### 5.4 Eventos (Observables)
- [ ] Crear: `deviationDetected$ = new Subject<{ duration: number }>()`
- [ ] Crear: `deviationResolved$ = new Subject<void>()`
- [ ] Emitir en momentos clave

### 5.5 Lógica de Detección (del original líneas 369-415)
- [ ] Check: `Math.abs(point.x) > threshold || Math.abs(point.y) > threshold`
- [ ] Si sí: inicializar deviationStartTime si no existe
- [ ] Calcular elapsed: `(now - deviationStartTime) / 1000`
- [ ] Si elapsed >= toleranceSeconds: emit deviationDetected$, set isDeviated=true
- [ ] Si regresa a zona segura: emit deviationResolved$, set isDeviated=false

### 5.6 Tests Unitarios
- [ ] Tests para GazeDeviationDetectionService:
  - [ ] Test: detección después de N segundos
  - [ ] Test: resolución cuando regresa
  - [ ] Test: respeta threshold configurado
  - [ ] Test: emite deviationDetected$ con duration
  - [ ] Test: emite deviationResolved$
  - [ ] Test: reset() limpia estado
  - [ ] Test: startMonitoring/stopMonitoring lifecycle
- [ ] Mock timers (jest.useFakeTimers())
- [ ] Target coverage: 85%+

### 5.7 Integración en Facade
- [ ] Inyectar `GazeDeviationDetectionService` en Facade
- [ ] En `completeCalibration()`: `service.startMonitoring()`
- [ ] Suscribir a pipeline:
  ```
  smoothing.pointSmoothed$
    → tap(point => deviationService.evaluatePoint(point))
  ```
- [ ] Suscribir a `deviationDetected$`:
  ```
  deviationService.deviationDetected$.subscribe(ev => {
    hasDeviation.set(true)
    logger('error', `Desviación por ${ev.duration}s`)
    deviationCallback?.()
  })
  ```

### 5.8 Validación
- [ ] npm test (GazeDeviationDetectionService tests pass)
- [ ] npm run lint
- [ ] npm run type-check
- [ ] Commit: `feat(gaze): extract GazeDeviationDetectionService`

---

## FASE 6: EXTRACCIÓN GazeWebGazerMutingService

### 6.1 Implementación Base
- [ ] Crear: `src/lib/services/gaze/gaze-webgazer-muting.service.ts`
- [ ] Definir interfaz:
  ```typescript
  startMuting(): void
  stopMuting(): void
  muteAllVideos(): void
  ```

### 6.2 Estado Interno
- [ ] `muteObserver: MutationObserver | null = null`
- [ ] `muteRetryInterval: IntervalHandle | undefined`

### 6.3 Métodos (del original líneas 420-521)
- [ ] `startMuting(): void`
  - [ ] `startAggressiveMuting()`
    - [ ] MutationObserver en document.body
    - [ ] Detectar <video> y setear muted=true
    - [ ] setInterval fallback cada 500ms durante 10s
- [ ] `stopMuting(): void`
  - [ ] `stopAggressiveMuting()`
    - [ ] observer.disconnect()
    - [ ] clearInterval()
- [ ] `muteAllVideos(): void`
  - [ ] Silenciar videos en DOM
  - [ ] Videos específicos de WebGazer por id

### 6.4 Tests Unitarios
- [ ] Tests para GazeWebGazerMutingService:
  - [ ] Test: `startMuting()` crea observer
  - [ ] Test: `stopMuting()` desconecta observer
  - [ ] Test: MutationObserver mute nuevos videos
  - [ ] Test: `muteAllVideos()` silencia existentes
  - [ ] Test: fallback interval funciona
- [ ] Mock MutationObserver
- [ ] Target coverage: 75%+ (es tricky testear DOM observers)

### 6.5 Integración en Facade
- [ ] Inyectar `GazeWebGazerMutingService` en Facade
- [ ] En `startCalibration()`: `service.startMuting()`
- [ ] En `stop()`: `service.stopMuting()`

### 6.6 Validación
- [ ] npm test (GazeWebGazerMutingService tests pass)
- [ ] npm run lint
- [ ] npm run type-check
- [ ] Commit: `feat(gaze): extract GazeWebGazerMutingService`

---

## FASE 7: REFACTOR FACADE + ORQUESTACIÓN

### 7.1 Crear Facade File
- [ ] Renombrar actual: `gaze-tracking.service.ts` → `gaze-tracking.service.legacy.ts`
- [ ] Crear: `gaze-tracking.service.ts` (NUEVO, como Facade)

### 7.2 Estructura del Facade
- [ ] Inyecciones:
  ```typescript
  constructor(
    private ngZone: NgZone,
    private calibration: GazeCalibrationService,
    private prediction: GazePredictionService,
    private smoothing: GazeSmoothingService,
    private metrics: GazeMetricsService,
    private deviation: GazeDeviationDetectionService,
    private muting: GazeWebGazerMutingService,
  ) {}
  ```

### 7.3 Métodos Públicos (IDÉNTICOS)
- [ ] `configure(config?, logger?, onDeviation?)`
  - [ ] Propagate a todos los servicios
  - [ ] Guardar callbacks
- [ ] `async startCalibration(existingStream?): Promise<boolean>`
  - [ ] Delegar a calibration service
- [ ] `recordCalibrationClick(screenX, screenY)`
  - [ ] Delegar a calibration service
- [ ] `completeCalibration()`
  - [ ] Iniciar todos los servicios (prediction, deviation, etc)
- [ ] `flushGazeBuffer(): GazePoint[]`
  - [ ] Delegar a metrics service
- [ ] `getGazeBuffer(): GazePoint[]`
  - [ ] Delegar a metrics service
- [ ] `stop()`
  - [ ] Detener todos los servicios

### 7.4 Signals Públicos (IDÉNTICOS)
- [ ] `readonly gazeState = signal<GazeState>('IDLE')`
- [ ] `readonly isCalibrated = signal(false)`
- [ ] `readonly lastPoint = signal<GazePoint | null>(null)`
- [ ] `readonly hasDeviation = signal(false)`

### 7.5 Pipeline de Datos (Constructor)
- [ ] Suscribir a `prediction.predictionReceived$`
- [ ] Map through smoothing
- [ ] Tap → update lastPoint signal
- [ ] Tap → metrics.recordPoint()
- [ ] Tap → deviation.evaluatePoint()

### 7.6 Suscripciones (Constructor)
- [ ] `calibration.calibrationCompleted$` → update isCalibrated
- [ ] `deviation.deviationDetected$` → hasDeviation.set(true) + callback
- [ ] `deviation.deviationResolved$` → hasDeviation.set(false)
- [ ] `prediction.trackingStopped$` → gazeState.set('IDLE')

### 7.7 Lifecycle
- [ ] ngOnDestroy → cleanup (DestroyRef)
- [ ] Todos los observables completados

### 7.8 Validación
- [ ] npm test (Facade tests pass)
- [ ] npm run lint
- [ ] npm run type-check
- [ ] Commit: `feat(gaze): create GazeTrackingFacade`

---

## FASE 8: TESTS DE INTEGRACIÓN & LIMPIEZA

### 8.1 Tests E2E (Facade)
- [ ] Crear: `src/lib/services/gaze/__tests__/gaze-tracking-facade.spec.ts`
- [ ] Tests:
  - [ ] `configure()` propaga config
  - [ ] `startCalibration()` → estado CALIBRATING
  - [ ] `completeCalibration()` → estado TRACKING
  - [ ] Pipeline: rawGaze → smooth → metrics → lastPoint.set()
  - [ ] Deviation detection completo
  - [ ] `stop()` limpia todo
  - [ ] Backward compatibility (interfaz idéntica)
- [ ] Target coverage: 70%+

### 8.2 Eliminar Legacy
- [ ] `gaze-tracking.service.legacy.ts` → DELETE
- [ ] Verificar no hay imports a legacy
- [ ] Search and replace imports en todo el proyecto

### 8.3 Actualizar Exports
- [ ] `src/lib/services/index.ts` → export Facade
- [ ] `src/lib/services/gaze/index.ts` → barrel exports
- [ ] Verificar imports en toda la aplicación

### 8.4 Actualizar Documentación
- [ ] README.md → explicar nueva arquitectura
- [ ] Inline docs en servicios
- [ ] Actualizar ejemplos de uso

### 8.5 Coverage Report
- [ ] `npm test -- --coverage`
- [ ] Target:
  - [ ] Statements: 80%+
  - [ ] Branches: 75%+
  - [ ] Functions: 80%+
  - [ ] Lines: 80%+
- [ ] Generar report HTML

### 8.6 Linting & Type Check
- [ ] `npm run lint`
- [ ] `npm run type-check`
- [ ] Fix all errors
- [ ] No warnings

### 8.7 Build
- [ ] `npm run build`
- [ ] Sin errores
- [ ] Sin warnings

### 8.8 Final Commit & Cleanup
- [ ] Commit: `refactor(gaze): complete service decomposition`
- [ ] Delete: `gaze-tracking.service.legacy.ts`
- [ ] Commit: `chore(gaze): remove legacy service`
- [ ] Cleanup: temporary test files
- [ ] Merge PR

---

## VALIDACIÓN FINAL

### Pre-Merge Checklist
- [ ] Todos los tests pasan (unit + integration)
- [ ] Coverage >= 80%
- [ ] No lint errors
- [ ] Type checking perfecto
- [ ] Build successful
- [ ] Backward compatible (interfaz pública sin cambios)
- [ ] Performance no degraded (benchmark vs original)
- [ ] Documentación actualizada
- [ ] PR reviewed y aprobado

### Post-Merge
- [ ] Staging deployment successful
- [ ] Manual testing de calibración + tracking
- [ ] No console errors
- [ ] No memory leaks (DevTools)
- [ ] Production deployment

---

## TIMELINE & COMMITS

```
Fase 0: Preparación
├─ [backup] GazeTrackingService antes de refactor
├─ [setup] Crear estructura de directorios
└─ [setup] Crear stubs de servicios

Fase 1: GazeCalibrationService
└─ feat(gaze): extract GazeCalibrationService

Fase 2: GazePredictionService
└─ feat(gaze): extract GazePredictionService

Fase 3: GazeSmoothingService
└─ feat(gaze): extract GazeSmoothingService

Fase 4: GazeMetricsService
└─ feat(gaze): extract GazeMetricsService

Fase 5: GazeDeviationDetectionService
└─ feat(gaze): extract GazeDeviationDetectionService

Fase 6: GazeWebGazerMutingService
└─ feat(gaze): extract GazeWebGazerMutingService

Fase 7: Facade & Orquestación
├─ feat(gaze): create GazeTrackingFacade
├─ test(gaze): add integration tests
└─ chore(gaze): remove legacy service

Fase 8: Limpieza & Documentación
└─ docs(gaze): update architecture documentation
```

---

**Creado**: 2026-03-11  
**Versión**: 1.0  
**Status**: READY FOR IMPLEMENTATION
