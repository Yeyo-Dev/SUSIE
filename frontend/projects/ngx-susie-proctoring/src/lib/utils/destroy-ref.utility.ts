import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

/**
 * Utilidad para gestionar limpieza de recursos en servicios.
 * 
 * Centraliza la gestión de:
 * - setTimeout/setInterval (timers)
 * - addEventListener (event listeners)
 * - RxJS subscriptions (con takeUntilDestroyed)
 * 
 * USO:
 * 1. Inyecta esta utilidad en tu servicio
 * 2. Usa los métodos para registrar timers y listeners
 * 3. La limpieza es automática en ngOnDestroy
 * 
 * EJEMPLO:
 * ```
 * @Injectable()
 * export class MiServicio {
 *   constructor(private cleanup = inject(DestroyRefUtility)) {}
 *   
 *   ngOnInit() {
 *     // Timer automático
 *     this.cleanup.setInterval(() => {...}, 1000);
 *     
 *     // Event listener automático
 *     this.cleanup.addEventListener(window, 'resize', () => {...});
 *     
 *     // Observable con takeUntilDestroyed
 *     this.observable$.pipe(
 *       takeUntilDestroyed(this.cleanup.ref)
 *     ).subscribe(...);
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class DestroyRefUtility {
  private destroyRef = inject(DestroyRef);

  /** Acceso directo a DestroyRef para usar con takeUntilDestroyed en otros servicios */
  get ref(): DestroyRef {
    return this.destroyRef;
  }

  /** Lista de timers activos para limpieza manual si es necesario */
  private activeTimers: ReturnType<typeof setTimeout>[] = [];

  /** Lista de intervals activos para limpieza manual si es necesario */
  private activeIntervals: ReturnType<typeof setInterval>[] = [];

  /** Lista de event listeners registrados: [target, event, handler, options] */
  private activeListeners: Array<{
    target: EventTarget;
    event: string;
    handler: EventListener | ((evt: unknown) => void);
    options?: boolean | AddEventListenerOptions;
  }> = [];

  constructor() {
    // Registrar cleanup en ngOnDestroy
    this.destroyRef.onDestroy(() => this.cleanup());
  }

  /**
   * Registra un setTimeout que será limpiado automáticamente.
   * @param callback Función a ejecutar
   * @param delay Milisegundos de espera
   * @returns ID del timeout (también almacenado internamente)
   */
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const timeoutId = setTimeout(() => {
      try {
        callback();
      } finally {
        // Remover de la lista después de ejecutarse
        const index = this.activeTimers.indexOf(timeoutId);
        if (index > -1) {
          this.activeTimers.splice(index, 1);
        }
      }
    }, delay);

    this.activeTimers.push(timeoutId);
    return timeoutId;
  }

  /**
   * Cancela un setTimeout registrado anteriormente.
   * @param timeoutId ID del timeout a cancelar
   */
  clearTimeout(timeoutId: ReturnType<typeof setTimeout>): void {
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    const index = this.activeTimers?.indexOf(timeoutId);
    if (index !== undefined && index > -1) {
      this.activeTimers.splice(index, 1);
    }
  }

  /**
   * Registra un setInterval que será limpiado automáticamente.
   * @param callback Función a ejecutar periódicamente
   * @param interval Milisegundos entre ejecuciones
   * @returns ID del interval (también almacenado internamente)
   */
  setInterval(callback: () => void, interval: number): ReturnType<typeof setInterval> {
    const intervalId = setInterval(callback, interval);
    this.activeIntervals.push(intervalId);
    return intervalId;
  }

  /**
   * Cancela un setInterval registrado anteriormente.
   * @param intervalId ID del interval a cancelar
   */
  clearInterval(intervalId: ReturnType<typeof setInterval>): void {
    if (!intervalId) return;
    clearInterval(intervalId);
    const index = this.activeIntervals?.indexOf(intervalId);
    if (index !== undefined && index > -1) {
      this.activeIntervals.splice(index, 1);
    }
  }

  /**
    * Registra un event listener que será removido automáticamente en ngOnDestroy.
    * IMPORTANTE: Usa arrow functions o referencias estables de métodos.
    * 
    * @param target Elemento o window/document donde se registra el listener
    * @param event Nombre del evento (ej: 'click', 'resize', 'beforeunload')
    * @param handler Función manejadora del evento (puede ser typado o EventListener)
    * @param options Opciones de addEventListener (passive, capture, once, etc)
    */
  addEventListener(
    target: EventTarget,
    event: string,
    handler: EventListener | ((evt: unknown) => void),
    options?: boolean | AddEventListenerOptions
  ): void {
    const listener = handler as EventListener;
    // Solo pasar options si está definido para evitar issues en tests
    if (options !== undefined) {
      target.addEventListener(event, listener, options);
    } else {
      target.addEventListener(event, listener);
    }
    this.activeListeners.push({ target, event, handler: listener, options });
  }

  /**
   * Remueve un event listener registrado anteriormente.
   * @param target Elemento donde fue registrado
   * @param event Nombre del evento
   * @param handler Función manejadora (DEBE ser la misma referencia)
   * @param options Opciones usadas en addEventListener
   */
  removeEventListener(
    target: EventTarget,
    event: string,
    handler: EventListener | ((evt: unknown) => void),
    options?: boolean | AddEventListenerOptions
  ): void {
    const listener = handler as EventListener;
    // Solo pasar options si está definido para evitar issues en tests
    if (options !== undefined) {
      target.removeEventListener(event, listener, options);
    } else {
      target.removeEventListener(event, listener);
    }
    const index = this.activeListeners.findIndex(
      (l) => l.target === target && l.event === event && l.handler === listener
    );
    if (index > -1) {
      this.activeListeners.splice(index, 1);
    }
  }

  /**
   * Limpia TODOS los recursos registrados: timers, intervals y event listeners.
   * Se llama automáticamente en ngOnDestroy, pero puede llamarse manualmente.
   */
  private cleanup(): void {
    // Limpiar todos los timers
    for (const timeoutId of this.activeTimers) {
      clearTimeout(timeoutId);
    }
    this.activeTimers = [];

    // Limpiar todos los intervals
    for (const intervalId of this.activeIntervals) {
      clearInterval(intervalId);
    }
    this.activeIntervals = [];

    // Limpiar todos los event listeners
    for (const { target, event, handler, options } of this.activeListeners) {
      target.removeEventListener(event, handler, options);
    }
    this.activeListeners = [];
  }

  /**
   * Retorna operador RxJS para use con takeUntilDestroyed().
   * PATRÓN MODERNO:
   * ```
   * observable$.pipe(
   *   takeUntilDestroyed(this.cleanup.ref)
   * ).subscribe(...);
   * ```
   */
  get takeUntilDestroyed() {
    return takeUntilDestroyed(this.destroyRef);
  }
}
