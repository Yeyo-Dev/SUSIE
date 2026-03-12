# GazeTrackingService Refactor Plan

**Documento de estrategia de descomposición del monolito GazeTrackingService (634 LOC)**

---

## 1. AUDITORÍA PROFUNDA

### 1.1 Estado Actual

| Métrica | Valor |
|---------|-------|
| **Líneas de código** | 634 |
| **Métodos públicos** | 9 |
| **Métodos privados** | 9 |
| **Signals Angular** | 4 |
| **Estado compartido privado** | 12+ propiedades |
| **Responsabilidades** | 5-6 principales |
| **Complejidad ciclomática** | 🔴 ALTA (niveles anidados, múltiples callbacks) |

### 1.2 Responsabilidades Identificadas

#### 1. **CALIBRATION** (líneas 104-194)
- `startCalibration()` — Inicializa WebGazer, inyecta stream, configura tracker
- `recordCalibrationClick()` — Registra punto de calibración
- `completeCalibration()` — Transición a TRACKING
- **Estado asociado**: `isCalibrated`, `gazeFrameCount`
- **Complejidad**: Monkey-patching de `navigator.mediaDevices.getUserMedia()`
- **Observación**: Mucha lógica de inicialización y limpieza de estado

#### 2. **TRACKING & SMOOTHING** (líneas 309-363)
- `processRawGaze()` — Escala pixel → [-1,1], suaviza con ventana deslizante, almacena buffer
- **Estado asociado**: `xHistory[]`, `yHistory[]`, `gazeBuffer[]`, `lastPoint`
- **Complejidad MEDIA**: Matemática simple pero crítica
- **Observación**: Este es el CORE del servicio. Debe ser especialmente testeable

#### 3. **POLLING & LIFECYCLE** (líneas 528-589)
- `startManualPolling()` — RAF + getCurrentPrediction() como fallback
- `stopManualPolling()` — Cancela RAF
- **Estado asociado**: `pollingRafId`, `lastPollTime`
- **Complejidad MEDIA**: Lógica de throttling y manejo de RAF
- **Observación**: Funciona EN PARALELO con `setGazeListener()`. Duplicación conceptual.

#### 4. **DEVIATION DETECTION** (líneas 369-415)
- `startDeviationDetection()` — Intervalo de 1s que verifica si estamos fuera de threshold
- `stopDeviationDetection()` — Para detección
- **Estado asociado**: `deviationStartTime`, `deviationCheckInterval`, `hasDeviation`
- **Complejidad BAJA**: Lógica simple de umbral con acumulador de tiempo
- **Observación**: ✅ Puede extraerse sin dependencias complicadas

#### 5. **VIDEO MUTING** (líneas 420-521)
- `muteAllWebgazerVideos()` — Silencia videos del DOM
- `startAggressiveMuting()` — MutationObserver + intervalo fallback
- `stopAggressiveMuting()` — Limpia observer
- **Estado asociado**: `muteObserver`, `muteRetryInterval`
- **Complejidad MEDIA**: Workaround a timing issue de WebGazer
- **Observación**: Esta es un **HACK NECESARIO**, no una responsabilidad de negocio

#### 6. **DIAGNOSTICS** (líneas 595-633)
- `startDiagnosticLoop()` — Verifica cada 10s que WebGazer procesa frames
- `stopDiagnosticLoop()` — Para diagnóstico
- **Estado asociado**: `diagnosticInterval`
- **Complejidad BAJA**: Logging y monitoreo
- **Observación**: Podría ser parte de un servicio de monitoreo o logging

### 1.3 Métodos Públicos (Interfaz de Usuario)

```typescript
configure(config?, logger?, onDeviation?)      // Configuración
startCalibration(existingStream?)              // Iniciar calibración
recordCalibrationClick(x, y)                   // Registrar clic
completeCalibration()                          // Completar calibración → TRACKING
flushGazeBuffer()                              // Obtener + limpiar buffer
getGazeBuffer()                                // Solo lectura
stop()                                         // Detener todo
```

**Signals exportados (lectura):**
```typescript
readonly gazeState: Signal<GazeState>
readonly isCalibrated: Signal<boolean>
readonly lastPoint: Signal<GazePoint | null>
readonly hasDeviation: Signal<boolean>
```

### 1.4 Dependencias Externas

| Dependencia | Uso | Criticidad |
|-------------|-----|-----------|
| `window.webgazer` | API principal de tracking | 🔴 CRÍTICA |
| `navigator.mediaDevices.getUserMedia` | Acceso a cámara (monkey-patched) | 🔴 CRÍTICA |
| `NgZone` | Escapar/entrar zona Angular | 🟡 ALTA |
| `DestroyRefUtility` | Gestión de cleanup | 🟡 ALTA |
| `MutationObserver` | Detección de nuevos videos | 🟢 BAJA |
| `requestAnimationFrame` | Polling de predicciones | 🟡 ALTA |

### 1.5 Problemas Actuales

1. **Testabilidad NULA**: No hay forma de mockear WebGazer sin editar el servicio
2. **Duplicación de fuentes**: Datos llegan de `setGazeListener()` Y de polling con `getCurrentPrediction()`
3. **Estado global**: 12+ propiedades privadas sin separación clara
4. **Responsabilidades mezcladas**: Negocio (calibración, tracking) + Infraestructura (muting, diagnostics)
5. **Workarounds sin encapsulación**: MutationObserver es un hack que vive en el mismo nivel que lógica de negocio
6. **Logging disperso**: `console.log()` + `this.logger()` sin estructura
7. **Signals vs. callbacks**: Mezcla de reactivity (signals) con callbacks (`onDeviation`)

---

## 2. DISEÑO DE DESCOMPOSICIÓN

### 2.1 Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│         GazeTrackingFacade (público, Angular)              │
│  - Configura y orquesta sub-servicios                       │
│  - Expone: signals (gazeState, lastPoint, etc)             │
│  - Métodos: configure(), calibrate(), startTracking()     │
└─────────────────────────────────────────────────────────────┘
         ↑         ↑         ↑         ↑
         │         │         │         │
    ┌────┴────┐┌──┴────────┐│┌────────┴─┐ ┌──────────────┐
    │          ││           ││           │ │              │
┌───▼────┐ ┌──▼────┐ ┌────▼▼─┐ ┌───────▼─▼────┐ ┌──────▼─┐
│Calibration│ Tracking │Aggregator│ DeviationDet  │ │ MutingBP │
│ Service  │ Service  │ Service   │ Service       │ │ Service  │
│          │          │           │               │ │(Best Prac)
└──────────┘ └────────┘ └─────────┘ └───────────────┘ └──────────┘

Legend: BP = "Best Practice" / Workaround
```

### 2.2 Servicios Propuestos

#### **A. GazeCalibrationService**

**Responsabilidad**: Gestionar el proceso de calibración inicial

**Métodos públicos**:
```typescript
async startCalibration(existingStream?: MediaStream): Promise<boolean>
recordCalibrationClick(screenX: number, screenY: number): void
completeCalibration(): Promise<void>
resetCalibration(): void
```

**Estado interno**:
```typescript
private calibrationStatus: 'idle' | 'in-progress' | 'completed' | 'error'
private calibrationData: { points: Point[], startedAt: number }
private webgazer: WebGazerAPI | null
```

**Dependencias inyectadas**:
- `ngZone: NgZone`
- `cleanup: DestroyRefUtility`
- `config: GazeConfig`
- `logger: LoggerFn`

**Eventos salientes** (via RxJS Subject):
```typescript
@Output() calibrationCompleted$: Subject<boolean>
@Output() calibrationProgress$: Subject<{ frames: number }>
```

**Notas**:
- Encapsula toda la lógica de WebGazer.begin(), setTracker(), setRegression()
- Maneja el monkey-patching de `navigator.mediaDevices.getUserMedia`
- RETORNA la referencia a WebGazer al Facade (no la mantiene)
- No conoce nada de tracking en tiempo real

---

#### **B. GazeTrackingService** (renombrado internamente como **GazePredictionService**)

**Responsabilidad**: Capturar y procesar predicciones en tiempo real

**Métodos públicos**:
```typescript
async startTracking(webgazer: WebGazerAPI): Promise<void>
stopTracking(): void
setGazeListener(callback: (prediction: WebGazerPrediction) => void): void
startManualPolling(): void
```

**Estado interno**:
```typescript
private isTracking: boolean
private lastPrediction: WebGazerPrediction | null
private webgazer: WebGazerAPI
private gazeFrameCount: number
private lastPollTime: number
private pollingRafId: number | null
```

**Eventos salientes**:
```typescript
@Output() predictionReceived$: Subject<RawGazeData>
@Output() trackingStarted$: Subject<void>
@Output() trackingStopped$: Subject<void>
```

**Notas**:
- Recibe WebGazer del Calibration Service
- Setea `setGazeListener()` Y mantiene fallback polling (RAF)
- SOLO emite datos crudos (x, y en píxeles)
- No suaviza, no agrega — eso es responsabilidad de Aggregator

---

#### **C. GazeDataAggregatorService** (renombrado: **GazeSmoothingService** + **GazeMetricsService**)

**División en DOS sub-servicios**:

##### **C1. GazeSmoothingService**
**Responsabilidad**: Suavizar y normalizar coordenadas de gaze

```typescript
// Entrada: raw pixels
smoothAndNormalize(rawX: number, rawY: number): GazePoint

// Estado:
private xHistory: number[]
private yHistory: number[]
private config: GazeConfig
```

**Métodos**:
```typescript
reset(): void
setSmootingWindow(size: number): void
```

**Outputs**:
```typescript
@Output() pointSmoothed$: Subject<GazePoint>
```

---

##### **C2. GazeMetricsService**
**Responsabilidad**: Agregar puntos suavizados para telemetría, historial

```typescript
recordPoint(point: GazePoint): void
getMetrics(): GazeMetrics
flushBuffer(): GazePoint[]
getBuffer(): GazePoint[]
```

**Estado**:
```typescript
private gazeBuffer: GazePoint[] = []
private maxBufferSize: number = 60
private stats: { count: number, minX: number, maxX: number, ... }
```

---

#### **D. GazeDeviationDetectionService**

**Responsabilidad**: Detectar cuando la mirada sale del área de pantalla

**Métodos públicos**:
```typescript
startMonitoring(): void
stopMonitoring(): void
getDeviationStatus(): boolean
```

**Estado interno**:
```typescript
private isDeviated: boolean
private deviationStartTime: number | null
private checkInterval: IntervalHandle
private config: GazeConfig
```

**Inputs**:
```typescript
subscribeToPoints(points$: Observable<GazePoint>): void
```

**Outputs**:
```typescript
@Output() deviationDetected$: Subject<{ duration: number }>
@Output() deviationResolved$: Subject<void>
```

**Notas**:
- Es "puro" — solo reacciona a puntos suavizados
- No sabe de WebGazer, calibración, etc.
- La única dependencia es Observable<GazePoint>

---

#### **E. GazeWebGazerMutingService** (WorkAround/Best Practice)

**Responsabilidad**: Encapsular el hack de silenciar videos de WebGazer

**Métodos públicos**:
```typescript
startMuting(): void
stopMuting(): void
muteAllVideos(): void
```

**Estado interno**:
```typescript
private muteObserver: MutationObserver | null
private muteRetryInterval: IntervalHandle | undefined
```

**Notas**:
- Este es un SERVICE DE INFRAESTRUCTURA, no de negocio
- Es desacoplable: si un día WebGazer no tiene timing issues, se elimina sin afectar el resto
- Inyectable pero NO crítico para funcionalidad

---

### 2.3 El Facade: GazeTrackingFacade (o mantener nombre "GazeTrackingService")

**Responsabilidad**: Orquestar los sub-servicios, mantener interfaz pública compatible

**Métodos públicos** (misma interfaz actual):
```typescript
configure(config, logger, onDeviation)
async startCalibration(existingStream?)
recordCalibrationClick(x, y)
completeCalibration()
flushGazeBuffer()
getGazeBuffer()
stop()
```

**Signals públicos** (mismos que ahora):
```typescript
readonly gazeState = signal<GazeState>
readonly isCalibrated = signal<boolean>
readonly lastPoint = signal<GazePoint | null>
readonly hasDeviation = signal<boolean>
```

**Inyecciones**:
```typescript
private calibrationService: GazeCalibrationService
private predictionService: GazePredictionService
private smoothingService: GazeSmoothingService
private metricsService: GazeMetricsService
private deviationService: GazeDeviationDetectionService
private mutingService: GazeWebGazerMutingService
```

**Flujo de orquestación**:
```
1. configure() → configura todos los servicios
2. startCalibration() → delega a CalibrationService
   - CalibrationService.startCalibration()
   - Emite calibrationCompleted$ cuando termina
   - Facade recibe WebGazer, lo guarda
3. completeCalibration() → inicia tracking en paralelo
   - PredictionService.startTracking(webgazer)
   - MutingService.startMuting()
   - DeviationService.startMonitoring()
   - Calibration → stop()
4. Flujo de datos (tiempo real):
   - PredictionService recibe datos de setGazeListener() + polling
   - Emite predictionReceived$ (datos crudos)
   - SmoothingService suscrito a predictionReceived$
   - Emite pointSmoothed$
   - MetricsService suscrito a pointSmoothed$ → guarda buffer
   - DeviationService suscrito a pointSmoothed$ → detecta desviaciones
   - Facade suscrito a pointSmoothed$ → actualiza signal lastPoint
5. stop() → detiene todos los servicios
```

---

## 3. DEPENDENCIAS Y ORQUESTACIÓN

### 3.1 Dependency Injection Graph

```
┌────────────────────────────────────────┐
│  GazeTrackingFacade (Injectable root)  │
│                                        │
│  inject(NgZone)                        │
│  inject(DestroyRefUtility)             │
│  inject(GazeCalibrationService)        │
│  inject(GazePredictionService)         │
│  inject(GazeSmoothingService)          │
│  inject(GazeMetricsService)            │
│  inject(GazeDeviationDetectionService) │
│  inject(GazeWebGazerMutingService)    │
└────────────────────────────────────────┘
         ↓ orquestra ↓
    ┌────────────────────────────────────────┐
    │    Sub-servicios (providedIn: root)    │
    │                                        │
    │  GazeCalibrationService                │
    │    └─ inject(NgZone, DestroyRefUtility)
    │                                        │
    │  GazePredictionService                 │
    │    └─ inject(NgZone, DestroyRefUtility)
    │                                        │
    │  GazeSmoothingService                  │
    │    └─ (no deps externas)              │
    │                                        │
    │  GazeMetricsService                    │
    │    └─ (no deps externas)              │
    │                                        │
    │  GazeDeviationDetectionService         │
    │    └─ inject(DestroyRefUtility)       │
    │                                        │
    │  GazeWebGazerMutingService            │
    │    └─ inject(DestroyRefUtility)       │
    └────────────────────────────────────────┘
```

### 3.2 Comunicación Inter-servicios

**Pattern: RxJS Subjects (no inyección circular)**

```typescript
// Flujo de observables (no hay referencias directas entre servicios)

PredictionService.predictionReceived$
    ├─→ SmoothingService.smoothAndNormalize()
    │       ↓
    │   pointSmoothed$
    │       ├─→ MetricsService.recordPoint()
    │       └─→ DeviationService (suscrito)
    │
    └─→ (debug logging)

DeviationService.deviationDetected$
    └─→ Facade → hasDeviation.set(true) → onDeviation callback
```

**Implementación en Facade**:
```typescript
constructor(
  private prediction: GazePredictionService,
  private smoothing: GazeSmoothingService,
  private metrics: GazeMetricsService,
  private deviation: GazeDeviationDetectionService,
  private ngZone: NgZone
) {
  // Conectar streams
  this.prediction.predictionReceived$
    .pipe(
      map(raw => this.smoothing.smoothAndNormalize(raw.x, raw.y)),
      tap(point => {
        this.ngZone.run(() => this.lastPoint.set(point));
        this.metrics.recordPoint(point);
        this.deviation.evaluatePoint(point);
      })
    )
    .subscribe();

  this.deviation.deviationDetected$.subscribe(ev => {
    this.ngZone.run(() => {
      this.hasDeviation.set(true);
      this.logger('error', `Desviación por ${ev.duration.toFixed(1)}s`);
      this.deviationCallback?.();
    });
  });
}
```

### 3.3 Evitar Dependencias Circulares

✅ **Strategy**: No inyectar servicios entre sí. Todo va a través del Facade.

- ❌ `GazeSmoothingService` NO inyecta `GazeMetricsService`
- ✅ `GazeMetricsService` se suscribe a observables públicos
- ✅ El Facade es el único que orquesta conexiones

---

## 4. PLAN DE MIGRACIÓN

### 4.1 Fase 0: Preparación (1-2 días)

- [ ] Crear carpeta `src/lib/services/gaze/`
- [ ] Crear archivos vacíos de sub-servicios (stubs)
- [ ] Mantener `gaze-tracking.service.ts` existente SIN CAMBIOS
- [ ] Crear tests para interfaz pública (smoke tests)

### 4.2 Fase 1: Extracción GazeCalibrationService (2-3 días)

- [ ] Crear `gaze-calibration.service.ts`
  - [ ] Extraer: `startCalibration()`, `recordCalibrationClick()`, `completeCalibration()`
  - [ ] Extraer estado: `isCalibrated`, `gazeFrameCount` (iniciales)
  - [ ] Extraer métodos privados: setup de WebGazer, logging
  - [ ] Emitir `calibrationCompleted$` Observable
- [ ] Tests unitarios para CalibrationService (mock WebGazer)
- [ ] Integración en Facade

### 4.3 Fase 2: Extracción GazePredictionService (2-3 días)

- [ ] Crear `gaze-prediction.service.ts`
  - [ ] Extraer: `startManualPolling()`, `stopManualPolling()` + listener setup
  - [ ] Extraer estado: `pollingRafId`, `gazeFrameCount`
  - [ ] Emitir `predictionReceived$` con datos crudos
- [ ] Tests unitarios (mock WebGazer, RAF)
- [ ] Integración en Facade

### 4.4 Fase 3: Extracción GazeSmoothingService (1-2 días)

- [ ] Crear `gaze-smoothing.service.ts`
  - [ ] Extraer: `processRawGaze()` → `smoothAndNormalize()`
  - [ ] Extraer estado: `xHistory[]`, `yHistory[]`
  - [ ] Emitir `pointSmoothed$`
- [ ] Tests: suavizado matemático (100% determinista)
- [ ] Integración

### 4.5 Fase 4: Extracción GazeMetricsService (1 día)

- [ ] Crear `gaze-metrics.service.ts`
  - [ ] Extraer: `flushGazeBuffer()`, `getGazeBuffer()`, almacenamiento
  - [ ] Extraer estado: `gazeBuffer[]`, `maxBufferSize`
  - [ ] Método: `recordPoint(point: GazePoint)`
- [ ] Tests: buffer management
- [ ] Integración

### 4.6 Fase 5: Extracción GazeDeviationDetectionService (1-2 días)

- [ ] Crear `gaze-deviation-detection.service.ts`
  - [ ] Extraer: `startDeviationDetection()`, `stopDeviationDetection()`
  - [ ] Extraer estado: `deviationStartTime`, `deviationCheckInterval`
  - [ ] Emitir `deviationDetected$`, `deviationResolved$`
- [ ] Tests (mock timers)
- [ ] Integración

### 4.7 Fase 6: Extracción GazeWebGazerMutingService (1 día)

- [ ] Crear `gaze-webgazer-muting.service.ts`
  - [ ] Extraer: `startAggressiveMuting()`, `stopAggressiveMuting()`, `muteAllWebgazerVideos()`
  - [ ] Extraer estado: `muteObserver`, `muteRetryInterval`
- [ ] Tests: observer lifecycle
- [ ] Integración

### 4.8 Fase 7: Refactor Facade + Backward Compatibility (2-3 días)

- [ ] Crear `gaze-tracking.facade.ts` (nuevo archivo)
- [ ] Migrar lógica de orquestación
- [ ] Conectar streams RxJS
- [ ] Mantener interfaz pública idéntica
- [ ] Tests de integración (end-to-end)
- [ ] Renombrar archivo actual → `gaze-tracking.service.legacy.ts` (backup)

### 4.9 Fase 8: Limpieza y Tests (1-2 días)

- [ ] Eliminar archivo legacy
- [ ] Tests de cobertura (aim for 80%+)
- [ ] Actualizar imports en todo el proyecto
- [ ] Validar en dev/staging

### 4.10 Timeline Total

**Optimista**: 2-3 semanas
**Realista**: 3-4 semanas
**Con testing exhaustivo**: 4-5 semanas

---

## 5. BACKWARD COMPATIBILITY

### 5.1 Interfaz Pública (SIN CAMBIOS)

El Facade mantiene la misma interfaz:

```typescript
// ✅ IDÉNTICO
configure(config?, logger?, onDeviation?)
startCalibration(existingStream?)
recordCalibrationClick(x, y)
completeCalibration()
flushGazeBuffer()
getGazeBuffer()
stop()

// ✅ IDÉNTICO (Signals)
readonly gazeState: Signal<GazeState>
readonly isCalibrated: Signal<boolean>
readonly lastPoint: Signal<GazePoint | null>
readonly hasDeviation: Signal<boolean>
```

### 5.2 Cambios Internos (NO visibles)

- ✅ Archivo de servicio renombrado a `gaze-tracking.facade.ts` (interno)
- ✅ Sub-servicios nuevos en `src/lib/services/gaze/` (internos)
- ✅ Tokens DI privados (usar `providedIn: 'root'`)

### 5.3 Mitigación de Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Regresiones en tracking | Tests de integración antes de merge |
| Performance degradation | Benchmarking con data histórica |
| Memory leaks | Validar cleanup con DevTools |
| WebGazer breaking changes | Isolar en CalibrationService |

---

## 6. ROLLBACK PLAN

Si algo sale mal durante migración:

### 6.1 Inmediato (< 1 hora)

```bash
# Si el merge fue hace poco
git revert <commit-hash>

# Si fue más atrás, revert selectivo
git revert -n <commit-start>..<commit-end>
git commit -m "Revert GazeTrackingService refactor"
```

### 6.2 A Medio Plazo (1-2 días)

- Mantener rama `feature/gaze-refactor` con histórico
- Branch `main` sigue sin cambios
- PR con revert si hay issues críticos
- Documento post-mortem

### 6.3 Test Antes de Rollback

```bash
# Validar que revert funciona
git log --oneline -5
git revert --no-commit <hash>
npm run test:gaze
npm run build
# Si funciona
git revert --abort
# Si rompe
git commit -m "Revert"
```

---

## 7. TESTING STRATEGY

### 7.1 Niveles de Testing

| Nivel | Alcance | Cobertura |
|-------|---------|-----------|
| **Unit** | Cada sub-servicio aislado | 80%+ |
| **Integration** | Facade + 2-3 servicios | 70%+ |
| **E2E** | Flujo completo calibración → tracking | 50%+ |

### 7.2 Casos de Test Críticos

```typescript
describe('GazeCalibrationService', () => {
  it('debería inicializar WebGazer correctamente')
  it('debería inyectar stream existente')
  it('debería emitir calibrationCompleted$ tras completeCalibration()')
  it('debería manejar errores de WebGazer gracefully')
})

describe('GazeSmoothingService', () => {
  it('debería normalizar píxeles a [-1, 1]')
  it('debería suavizar con ventana correcta')
  it('debería manejar ventana vacía sin crash')
})

describe('GazeDeviationDetectionService', () => {
  it('debería detectar desviación tras N segundos')
  it('debería resolver desviación cuando regresa')
  it('debería respetar threshold configurado')
})

describe('GazeTrackingFacade', () => {
  it('debería orquestar calibración → tracking completo')
  it('debería mantener compatibilidad con interfaz anterior')
  it('debería emitir hasDeviation correctamente')
  it('debería limpiar recursos en stop()')
})
```

---

## 8. DEPENDENCY INJECTION CONFIGURATION

### 8.1 Module Setup

```typescript
// gaze-tracking.module.ts (NEW)
import { NgModule } from '@angular/core';
import { GazeTrackingFacade } from './gaze-tracking.facade';
import { GazeCalibrationService } from './gaze/gaze-calibration.service';
import { GazePredictionService } from './gaze/gaze-prediction.service';
import { GazeSmoothingService } from './gaze/gaze-smoothing.service';
import { GazeMetricsService } from './gaze/gaze-metrics.service';
import { GazeDeviationDetectionService } from './gaze/gaze-deviation-detection.service';
import { GazeWebGazerMutingService } from './gaze/gaze-webgazer-muting.service';

@NgModule({
  providers: [
    GazeTrackingFacade,
    GazeCalibrationService,
    GazePredictionService,
    GazeSmoothingService,
    GazeMetricsService,
    GazeDeviationDetectionService,
    GazeWebGazerMutingService,
  ],
})
export class GazeTrackingModule {}
```

**O provider de root** (si no hay módulo):

```typescript
// gaze-tracking.facade.ts
@Injectable({ providedIn: 'root' })
export class GazeTrackingFacade {
  // Los sub-servicios se inyectan aquí
  // Cada uno tiene providedIn: 'root'
}
```

---

## 9. FILE STRUCTURE

```
src/lib/services/
├── gaze-tracking.facade.ts          ← Facade (orquestador)
├── gaze-tracking.module.ts          ← Module (opcional)
├── gaze/
│   ├── gaze-calibration.service.ts
│   ├── gaze-prediction.service.ts
│   ├── gaze-smoothing.service.ts
│   ├── gaze-metrics.service.ts
│   ├── gaze-deviation-detection.service.ts
│   ├── gaze-webgazer-muting.service.ts
│   └── __tests__/
│       ├── gaze-calibration.service.spec.ts
│       ├── gaze-prediction.service.spec.ts
│       ├── gaze-smoothing.service.spec.ts
│       ├── gaze-metrics.service.spec.ts
│       ├── gaze-deviation-detection.service.spec.ts
│       ├── gaze-webgazer-muting.service.spec.ts
│       └── gaze-tracking.facade.spec.ts
├── models/
│   ├── gaze.contracts.ts            ← Tipos compartidos
│   └── gaze-config.ts
└── utils/
    └── gaze-factory.ts              ← Builders si es necesario
```

---

## 10. RISK ASSESSMENT

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|-----------|
| Regresión en tracking | MEDIA | ALTO | Tests exhaustivos, staging |
| Memory leak en RAF | BAJA | ALTO | Validar cleanup |
| WebGazer timing issue | BAJA | ALTO | Isolar en CalibrationService |
| DI complexity | BAJA | MEDIO | Documentar inyecciones |
| Performance hit | BAJA | MEDIO | Benchmarking |

---

## 11. NEXT STEPS

1. **Aprobación de arquitectura** ← YOU ARE HERE
2. Crear rama: `feature/gaze-refactor-descomposicion`
3. Fase 0: Preparación (stubs)
4. Fase 1-6: Implementación iterativa
5. Fase 7-8: Integración y limpieza
6. PR review + staging
7. Merge a main

---

## 12. APPENDIX: Current Responsibility Map

| Responsabilidad | Líneas | Método | Nuevo Servicio |
|-----------------|--------|--------|----------------|
| WebGazer init | 104-127 | startCalibration() | GazeCalibrationService |
| Tracker setup | 128-130 | setTracker, setRegression | GazeCalibrationService |
| Gaze listener | 131-154 | setGazeListener | GazePredictionService |
| Calibration complete | 198-206 | completeCalibration (partial) | GazeCalibrationService |
| Manual polling | 528-582 | startManualPolling/stopManualPolling | GazePredictionService |
| Raw gaze processing | 309-363 | processRawGaze | GazeSmoothingService |
| Smoothing math | 317-327 | xHistory/yHistory logic | GazeSmoothingService |
| Buffer management | 260-271 | flushGazeBuffer/getGazeBuffer | GazeMetricsService |
| Deviation detection | 369-415 | startDeviationDetection | GazeDeviationDetectionService |
| Video muting | 420-521 | muteAllWebgazerVideos, startAggressiveMuting | GazeWebGazerMutingService |
| Diagnostics | 595-633 | startDiagnosticLoop | (Optional: GazeDiagnosticsService) |
| Cleanup | 276-301 | stop() | GazeTrackingFacade |

---

**Documento generado**: 2026-03-11  
**Próxima revisión**: Después de Fase 0 (Preparación)
