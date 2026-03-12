# Typing Guide - SUSIE Proctoring

## Por qué No Usamos `any` Types

En SUSIE **prohibimos `any` types** porque:

1. **Pierdes seguridad de tipos**: El compilador no puede verificar si estás usando la propiedad correcta
2. **Introduces bugs silenciosos**: Cambias el nombre de una propiedad y la app sigue compilando
3. **Hace el refactoring imposible**: No sabes dónde se usa una propiedad si está tipada como `any`
4. **Rompe la experiencia del IDE**: Sin tipos, no hay autocomplete ni hints útiles
5. **Dificulta el onboarding**: Nuevos devs no saben qué datos espera cada función

### Ejemplo del Problema:

```typescript
// ❌ MALO - any es un agujero de seguridad
function processViolation(violation: any) {
  console.log(violation.tipo); // ¿Existe 'tipo'? ¿O es 'type'?
  if (violation.timstamp) { // Typo silencioso!
    // ...
  }
}

// Llamada:
processViolation({ type: 'TAB_SWITCH', timestamp: '2025-01-01T10:00:00' });
// ^^ No hay error — pero violation.tipo es undefined
```

**Resultado**: Un bug que no se detecta en compilación.

---

## Solución: Usar Interfaces en `contracts.ts`

SUSIE centraliza todos los tipos en **`src/lib/models/contracts.ts`**.

### Paso 1: Define la Interfaz

```typescript
// En contracts.ts
export interface SecurityViolation {
  type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'FOCUS_LOST' | 'INSPECTION_ATTEMPT';
  message: string;
  timestamp: string;
}
```

### Paso 2: Úsala en tu código

```typescript
// ✅ BIEN - totalmente tipado
import { SecurityViolation } from '../models/contracts';

function processViolation(violation: SecurityViolation) {
  console.log(violation.type); // ✓ TypeScript sabe que 'type' existe
  console.log(violation.timestamp); // ✓ Autocompletado
}

// Llamada:
processViolation({ type: 'TAB_SWITCH', timestamp: '2025-01-01T10:00:00' });
// Compilador verifica:
// - ¿Tiene 'type'? Sí ✓
// - ¿Tiene 'timestamp'? Sí ✓
// - ¿Es un valor válido de type? Sí ✓
```

---

## Interfaces Disponibles en contracts.ts

Estas son las interfaces principales de SUSIE. **Úsalas en lugar de `any`**.

### Security & Monitoring

```typescript
// Una violación de seguridad detectada
export interface SecurityViolation {
  type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'FOCUS_LOST' | 'INSPECTION_ATTEMPT' | 'NAVIGATION_ATTEMPT' | 'RELOAD_ATTEMPT' | 'CLIPBOARD_ATTEMPT' | 'GAZE_DEVIATION';
  message: string;
  timestamp: string;
}
```

### Consent & Permissions

```typescript
// Resultado del paso de consentimiento
export interface ConsentResult {
  accepted: boolean;
  timestamp: string;
  permissionsConsented: ConsentPermission[];
}

// Permisos individuales
export type ConsentPermission = 'camera' | 'microphone' | 'biometrics';
```

### Exam Engine

```typescript
// Pregunta del examen
export interface SusieQuestion {
  id: number;
  content: string;
  options: string[];
  image?: string | null;
  correctAnswer?: string; // Solo en dev, no en producción
}

// Resultado final del examen
export interface ExamResult {
  answers: Record<number, string>;
  completedAt: string;
  score?: number;
  metadata?: Record<string, unknown>;
  proctoringSummary?: {
    totalViolations: number;
    tabSwitches: number;
    snapshots: {
      biometric: number;
      monitoring: number;
    };
  };
}
```

### Backend API Responses

```typescript
// GET /evaluaciones/configuracion/:evaluacion_id
export interface BackendEvaluacionResponse {
  success: boolean;
  evaluacion: {
    evaluacion: {
      examen_id: string;
      examen_titulo: string;
      duracion_minutos: number;
      // ... más campos
    };
    configuracion: {
      analisis_mirada: boolean;
      camara: boolean;
      // ... más campos
    };
  };
}

// GET /examenes/:examen_id
export interface BackendExamenResponse {
  success: boolean;
  data: {
    detalles: {
      examen_id: string;
      titulo: string;
      // ... más campos
    };
    preguntas: Array<{
      pregunta_id: string;
      contenido: string;
      imagen: string | null;
      opciones: string[];
    }>;
  };
}
```

---

## Cómo Crear Nuevas Interfaces

Si necesitas una nueva estructura de datos:

### Paso 1: Identifica qué datos necesitas

```typescript
// Mi servicio necesita almacenar:
// - ID del usuario
// - Nombre completo
// - Email
// - Rol (admin, student, proctor)
// - ¿Datos opcionales?
```

### Paso 2: Crea la interfaz en `contracts.ts`

```typescript
// En contracts.ts
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'student' | 'proctor';
  metadata?: Record<string, unknown>; // Para datos futuros sin migración
}
```

### Paso 3: Úsala en tu servicio/componente

```typescript
import { User } from '../models/contracts';

@Injectable({ providedIn: 'root' })
export class UserService {
  private currentUser = signal<User | null>(null);

  getCurrentUser(): Signal<User | null> {
    return this.currentUser.asReadonly();
  }

  setCurrentUser(user: User): void {
    this.currentUser.set(user);
  }
}
```

---

## Patrones de Typing Comunes

### Patrón 1: Funciones Tipadas con Interfaces

```typescript
// ❌ MALO - parámetros sin tipo
function updateViolationCount(data) {
  data.count++;
}

// ✅ BIEN - parámetro tipado
function updateViolationCount(data: SecurityViolation): void {
  // Ahora sabes qué propiedades tiene data
}
```

---

### Patrón 2: Señales Tipadas

```typescript
// ❌ MALO
violations = signal<any>([]);

// ✅ BIEN
violations = signal<SecurityViolation[]>([]);
```

---

### Patrón 3: Observables Tipados

```typescript
// ❌ MALO
examResult$: Observable<any>;

// ✅ BIEN
examResult$: Observable<ExamResult>;
```

---

### Patrón 4: Inputs Tipados (Componentes)

```typescript
@Component({...})
export class ViolationDisplayComponent {
  // ❌ MALO
  violation = input<any>();

  // ✅ BIEN
  violation = input.required<SecurityViolation>();
}
```

---

### Patrón 5: Event Emitters Tipados

```typescript
@Component({...})
export class ConsoleComponent {
  // ❌ MALO
  @Output() onViolation = new EventEmitter<any>();

  // ✅ BIEN
  @Output() onViolation = new EventEmitter<SecurityViolation>();

  reportViolation(violation: SecurityViolation) {
    this.onViolation.emit(violation);
  }
}
```

---

### Patrón 6: HTTP Responses Tipadas

```typescript
@Injectable({ providedIn: 'root' })
export class ExamService {
  constructor(private http: HttpClient) {}

  // ❌ MALO
  getExam(id: string) {
    return this.http.get(`/api/exams/${id}`);
  }

  // ✅ BIEN
  getExam(id: string): Observable<BackendExamenResponse> {
    return this.http.get<BackendExamenResponse>(`/api/exams/${id}`);
  }
}
```

---

### Patrón 7: Servicios que Inyectan Logger

Algunos servicios en SUSIE usan un Logger inyectable. Úsalo así:

```typescript
import { Logger } from '../services/logger.service';

@Injectable({ providedIn: 'root' })
export class MyService {
  private logger = inject(Logger);

  doSomething(data: SecurityViolation) {
    this.logger.log('Processing violation', { type: data.type });
  }
}
```

---

### Patrón 8: Servicios que Usan WebGazer

Si tu servicio usa WebGazer (eye tracking), tienes tipos disponibles:

```typescript
import { WebGazerService } from '../services/webgazer.service';

@Injectable({ providedIn: 'root' })
export class GazeAnalysisService {
  private webgazer = inject(WebGazerService);

  async startTracking(): Promise<void> {
    const predictions = await this.webgazer.track();
    // predictions es tipado como { x: number; y: number; }[]
  }
}
```

---

## Ejemplos Completos

### Ejemplo 1: Servicio de Monitoreo de Violaciones

```typescript
import { Injectable, signal, inject } from '@angular/core';
import { SecurityViolation } from '../models/contracts';
import { DestroyRefUtility } from '../utils/destroy-ref.utility';

@Injectable({ providedIn: 'root' })
export class ViolationMonitorService {
  private violations = signal<SecurityViolation[]>([]);
  private cleanup = inject(DestroyRefUtility);

  violations$ = this.violations.asReadonly();

  constructor() {
    // Cada 10 segundos, validar violaciones
    this.cleanup.setInterval(() => {
      this.checkForViolations();
    }, 10000);
  }

  private checkForViolations(): void {
    // Lógica de validación tipada
    const newViolations: SecurityViolation[] = [
      {
        type: 'FOCUS_LOST',
        message: 'Window lost focus',
        timestamp: new Date().toISOString(),
      },
    ];

    this.violations.update(current => [...current, ...newViolations]);
  }

  reportViolation(violation: SecurityViolation): void {
    this.violations.update(current => [...current, violation]);
  }
}
```

### Ejemplo 2: Componente que Consume Exam Result

```typescript
import { Component, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExamResult } from '../models/contracts';

@Component({
  selector: 'susie-exam-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <h2>Exam Summary</h2>
      <p>Completed at: {{ result().completedAt }}</p>
      <p>Score: {{ result().score }}/100</p>
      <p>Violations: {{ result().proctoringSummary?.totalViolations }}</p>
    </div>
  `,
})
export class ExamSummaryComponent {
  // ✅ Input completamente tipado
  result = input.required<ExamResult>();
}
```

### Ejemplo 3: Service que Llama Backend

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BackendEvaluacionResponse,
  BackendExamenResponse,
} from '../models/contracts';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);

  // ✅ Retorna tipos específicos del backend
  getEvaluacionConfig(id: string): Observable<BackendEvaluacionResponse> {
    return this.http.get<BackendEvaluacionResponse>(
      `/api/evaluaciones/configuracion/${id}`
    );
  }

  getExam(id: string): Observable<BackendExamenResponse> {
    return this.http.get<BackendExamenResponse>(`/api/examenes/${id}`);
  }
}
```

---

## Checklist de Typing

Cuando escribas código nuevo:

- [ ] ¿Todas las funciones tienen tipos de parámetros y retorno?
- [ ] ¿Las señales tienen tipos explícitos? (`signal<Type>()`))
- [ ] ¿Los observables tienen tipos explícitos? (`Observable<Type>`)
- [ ] ¿Los inputs de componentes tienen tipos? (`input<Type>()` o `input.required<Type>()`)
- [ ] ¿No hay ningún `any` en el archivo?
- [ ] ¿Las llamadas HTTP usan `<Response Type>` en `http.get<T>()`?
- [ ] ¿Los métodos que retornan objetos usan interfaces de `contracts.ts`?

---

## Anti-Patterns: Qué NO Hacer

### ❌ ANTI-PATTERN 1: Función sin tipos

```typescript
// ❌ MALO
function processData(data) {
  return data.violation;
}
```

**Solución**:
```typescript
// ✅ BIEN
function processViolation(data: SecurityViolation): SecurityViolation {
  return data;
}
```

---

### ❌ ANTI-PATTERN 2: HTTP sin tipo de respuesta

```typescript
// ❌ MALO
this.http.get('/api/exams/123').subscribe(data => {
  console.log(data.titulo); // ¿Existe 'titulo'?
});
```

**Solución**:
```typescript
// ✅ BIEN
this.http.get<BackendExamenResponse>('/api/exams/123').subscribe(data => {
  console.log(data.success); // TypeScript sabe que existe
  console.log(data.data.detalles.titulo); // Acceso seguro
});
```

---

### ❌ ANTI-PATTERN 3: Señales sin tipo

```typescript
// ❌ MALO
violations = signal([]); // ¿Qué es violations? ¿unknown[]?

violations.update(v => [...v, { /* ... */ }]); // TypeError potencial
```

**Solución**:
```typescript
// ✅ BIEN
violations = signal<SecurityViolation[]>([]);

violations.update(v => [...v, newViolation]); // TypeScript verifica newViolation
```

---

## Resumen

1. **NUNCA uses `any`** — es un agujero de seguridad
2. **SIEMPRE define interfaces en `contracts.ts`** — centraliza los tipos
3. **USA las interfaces existentes** antes de crear nuevas
4. **Todas las funciones deben tener tipos** — parámetros y retorno
5. **Las señales, observables e inputs deben ser tipados** — explícitamente
6. **HTTP responses deben usar `<Type>`** — `http.get<BackendType>()`

**La regla de oro**: Si TypeScript no puede validar que algo es correcto, está mal tipado.
