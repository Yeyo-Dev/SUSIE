# Cleanup Policy - SUSIE Proctoring

## El Problema: Memory Leaks

Cuando un servicio o componente se destruye sin limpiar sus recursos, los timers, event listeners y subscriptions siguen ejecutándose en memoria. Esto genera:

- **Memory leaks** que degradan la app progresivamente
- **Event listeners fantasma** que reaccionan a eventos después de destruirse
- **Timers que siguen consumiendo CPU** aunque el componente ya no exista
- **Multiple subscriptions** si el componente se instancia múltiples veces

### Ejemplo del Problema (ANTI-PATTERN):

```typescript
// ❌ MALO - sin cleanup
export class MyService {
  constructor() {
    // Este listener NUNCA se va a remover
    window.addEventListener('resize', this.handleResize);
    
    // Este interval NUNCA se va a detener
    setInterval(() => {
      console.log('Still running after destroy...');
    }, 1000);
  }
  
  private handleResize = () => { /* ... */ };
}
```

**Resultado**: Cada vez que se crea una nueva instancia del servicio, se acumulan listeners y timers. La app se vuelve más lenta.

---

## La Solución: DestroyRefUtility + DestroyRef

Angular 16+ proporciona `DestroyRef` para ejecutar código en `ngOnDestroy` automáticamente. Pero el patrón se vuelve tedioso si tienes muchos timers y listeners.

**SUSIE usa `DestroyRefUtility`**: una utilidad que centraliza la limpieza de:
- `setTimeout` y `setInterval`
- `addEventListener` y `removeEventListener`
- RxJS subscriptions (con `takeUntilDestroyed`)

### La Solución es Simple:

**Punto 1: Inyecta `DestroyRefUtility`**

```typescript
@Injectable()
export class MyService {
  private cleanup = inject(DestroyRefUtility);
}
```

**Punto 2: Usa los métodos de cleanup en lugar de native APIs**

- `cleanup.setInterval()` en lugar de `setInterval()`
- `cleanup.addEventListener()` en lugar de `addEventListener()`
- `cleanup.setTimeout()` en lugar de `setTimeout()`

**Punto 3: La limpieza es automática**

Cuando el servicio se destruye, todos los timers, intervals y listeners se limpian automáticamente. No necesitas escribir `ngOnDestroy` manual.

---

## Patrones de Uso

### 1. Timers: `cleanup.setInterval()`

**Caso**: Un servicio que verifica estado cada 5 segundos.

```typescript
@Injectable({ providedIn: 'root' })
export class HealthCheckService {
  private cleanup = inject(DestroyRefUtility);

  constructor() {
    // Este interval se limpia automáticamente
    this.cleanup.setInterval(() => {
      console.log('Checking health...');
      this.checkServer();
    }, 5000);
  }

  private checkServer() {
    // Lógica de verificación
  }
}
```

**¿Qué sucede?**
- En `ngOnDestroy`, el interval se cancela automáticamente
- No necesitas almacenar el ID del interval

---

### 2. Event Listeners: `cleanup.addEventListener()`

**Caso**: Un servicio que detecta cambios de conectividad.

```typescript
@Injectable({ providedIn: 'root' })
export class NetworkMonitorService {
  isOnline = signal<boolean>(navigator.onLine);

  private cleanup = inject(DestroyRefUtility);

  // ✅ Arrow function = referencia estable
  private handleOnline = () => this.isOnline.set(true);
  private handleOffline = () => this.isOnline.set(false);

  constructor() {
    // Estos listeners se limpian automáticamente
    this.cleanup.addEventListener(window, 'online', this.handleOnline);
    this.cleanup.addEventListener(window, 'offline', this.handleOffline);
  }
}
```

**¿Qué sucede?**
- Los listeners se registran en `addEventListener`
- Se rastrean internamente en `DestroyRefUtility`
- En `ngOnDestroy`, se limpian automáticamente con `removeEventListener`

---

### 3. RxJS Subscriptions: `takeUntilDestroyed()`

**Caso**: Un servicio que monitorea cambios en tiempo real.

```typescript
@Injectable({ providedIn: 'root' })
export class RealtimeMonitorService {
  private cleanup = inject(DestroyRefUtility);
  private apiService = inject(ApiService);

  data$ = new Observable<Data>(subscriber => {
    this.apiService.getRealtime()
      .pipe(
        // ✅ takeUntilDestroyed usa el DestroyRef interno
        takeUntilDestroyed(this.cleanup.ref)
      )
      .subscribe(data => subscriber.next(data));
  });
}
```

**¿Qué sucede?**
- El observable se desuscribe automáticamente en `ngOnDestroy`
- No necesitas guardar la suscripción en una variable
- Si el componente se destruye, la suscripción se cancela

---

### 4. Limpieza Manual (Raro)

Si necesitas cancelar un timer/listener **antes** de que se destruya el servicio:

```typescript
@Injectable()
export class MyService {
  private cleanup = inject(DestroyRefUtility);

  constructor() {
    const intervalId = this.cleanup.setInterval(() => {
      // ...
    }, 1000);

    // Más tarde: cancelar manualmente
    this.cleanup.clearInterval(intervalId);
  }
}
```

---

## Anti-Patterns: Qué NO Hacer

### ❌ ANTI-PATTERN 1: Usar `setInterval()` nativo sin cleanup

```typescript
// ❌ MALO
export class BadService {
  constructor() {
    setInterval(() => { /* ... */ }, 1000); // LEAK!
  }
}
```

**Problema**: El interval sigue corriendo después de que el servicio se destruye.

**Solución**:
```typescript
// ✅ BIEN
private cleanup = inject(DestroyRefUtility);

constructor() {
  this.cleanup.setInterval(() => { /* ... */ }, 1000);
}
```

---

### ❌ ANTI-PATTERN 2: Usar `addEventListener()` nativo sin rastreo

```typescript
// ❌ MALO
export class BadService {
  constructor() {
    window.addEventListener('resize', this.handleResize); // LEAK!
  }
  
  private handleResize = () => { /* ... */ };
}
```

**Problema**: El listener nunca se remueve.

**Solución**:
```typescript
// ✅ BIEN
private cleanup = inject(DestroyRefUtility);
private handleResize = () => { /* ... */ };

constructor() {
  this.cleanup.addEventListener(window, 'resize', this.handleResize);
}
```

---

### ❌ ANTI-PATTERN 3: Usar métodos tradicionales como handler

```typescript
// ❌ MALO - referencia inestable
export class BadService {
  private cleanup = inject(DestroyRefUtility);

  constructor() {
    window.addEventListener('click', this.handleClick); // ¿Qué referencia se guarda?
  }

  private handleClick() {
    // Método tradicional - referencia diferente cada vez
    console.log('Clicked');
  }
}
```

**Problema**: Cada vez que se accede a `this.handleClick`, es una referencia diferente. `removeEventListener` no puede encontrarlo.

**Solución**:
```typescript
// ✅ BIEN - arrow function = referencia estable
private cleanup = inject(DestroyRefUtility);
private handleClick = () => {
  console.log('Clicked');
};

constructor() {
  this.cleanup.addEventListener(window, 'click', this.handleClick);
}
```

---

### ❌ ANTI-PATTERN 4: Subscriptions sin `takeUntilDestroyed()`

```typescript
// ❌ MALO
export class BadService {
  constructor(private api: ApiService) {
    this.api.data$.subscribe(data => {
      console.log(data); // ¿Cuándo se desuscribe?
    });
  }
}
```

**Problema**: La suscripción permanece activa incluso después de que el servicio se destruye.

**Solución**:
```typescript
// ✅ BIEN
export class GoodService {
  private cleanup = inject(DestroyRefUtility);
  
  constructor(private api: ApiService) {
    this.api.data$.pipe(
      takeUntilDestroyed(this.cleanup.ref)
    ).subscribe(data => {
      console.log(data);
    });
  }
}
```

---

## Checklist para Code Review

Cuando revises un PR, verifica:

### ✅ Cleanup

- [ ] ¿Hay `setInterval()` o `setTimeout()` que usen `cleanup.setInterval()` o `cleanup.setTimeout()`?
- [ ] ¿Hay `addEventListener()` que use `cleanup.addEventListener()`?
- [ ] ¿Hay subscriptions RxJS que usen `takeUntilDestroyed(cleanup.ref)`?
- [ ] ¿Se importa `DestroyRefUtility` cuando se necesita cleanup?

### ✅ Event Listeners

- [ ] ¿Los handlers son arrow functions o referencias estables?
- [ ] ¿Se pasan correctamente al método `addEventListener(target, event, handler, options)`?

### ✅ Timers

- [ ] ¿Se guardan IDs si es necesario limpiarlos manualmente?
- [ ] ¿Se usan `cleanup.setTimeout()` y `cleanup.setInterval()` en lugar de nativos?

### ✅ Servicios Inyectables

- [ ] ¿Todos los servicios que tienen listeners/timers inyectan `DestroyRefUtility`?
- [ ] ¿Ningún servicio tiene cleanup manual incompleto?

---

## Uso en Componentes vs Servicios

### En Servicios (Recomendado)

Los servicios normalmente inyectan `DestroyRefUtility`:

```typescript
@Injectable({ providedIn: 'root' })
export class MyService {
  private cleanup = inject(DestroyRefUtility);

  constructor() {
    this.cleanup.setInterval(() => { /* ... */ }, 1000);
  }
}
```

### En Componentes (Usualmente innecesario)

Los componentes pueden usar `DestroyRef` nativo si necesitan cleanup:

```typescript
@Component({...})
export class MyComponent {
  private destroyRef = inject(DestroyRef);

  constructor() {
    // Para casos muy simples, DestroyRef es suficiente
    this.destroyRef.onDestroy(() => {
      console.log('Component is being destroyed');
    });
  }
}
```

Pero si el componente tiene muchos listeners/timers, también puede inyectar `DestroyRefUtility`:

```typescript
@Component({...})
export class MyComponent {
  private cleanup = inject(DestroyRefUtility);

  constructor() {
    this.cleanup.addEventListener(window, 'resize', () => {
      // ...
    });
  }
}
```

---

## Referencia Rápida

| Caso | Patrón | Limpieza |
|------|--------|----------|
| Timer simple | `cleanup.setTimeout(fn, ms)` | Automática |
| Interval | `cleanup.setInterval(fn, ms)` | Automática |
| Event listener | `cleanup.addEventListener(target, event, handler)` | Automática |
| RxJS | `observable.pipe(takeUntilDestroyed(cleanup.ref))` | Automática |
| Cancelar manualmente | `cleanup.clearTimeout(id)` o `cleanup.clearInterval(id)` | Manual |
| Remover listener | `cleanup.removeEventListener(target, event, handler)` | Manual |

---

## Resumen

1. **Inyecta `DestroyRefUtility`** en servicios que usan timers, listeners o subscriptions
2. **Usa los métodos cleanup** en lugar de APIs nativas
3. **La limpieza es automática** en `ngOnDestroy`
4. **Los handlers deben ser arrow functions** para referencias estables
5. **Revisa los anti-patterns** para no introducir leaks

**La regla de oro**: Si algo corre en un timer o listener, debe limpiar sus propios recursos.
