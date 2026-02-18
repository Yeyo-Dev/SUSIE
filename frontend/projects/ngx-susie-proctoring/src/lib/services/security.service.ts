import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SusieConfig, SecurityViolation } from '../models/contracts';

@Injectable({
    providedIn: 'root'
})
export class SecurityService {
    private config: SusieConfig['securityPolicies'] | undefined;
    private onViolation: ((violation: SecurityViolation) => void) | undefined;
    private platformId = inject(PLATFORM_ID);

    // Estado reactivo: permite que el wrapper u otros componentes reaccionen a violaciones en tiempo real
    private violationCountSignal = signal(0);
    private lastViolationSignal = signal<SecurityViolation | null>(null);

    readonly violationCount = this.violationCountSignal.asReadonly();
    readonly lastViolation = this.lastViolationSignal.asReadonly();

    // Referencias a handlers: necesarias para poder removerlos en destroy() y evitar memory leaks
    private handlerContextMenu: ((e: MouseEvent) => void) | null = null;
    private handlerKeydown: ((e: KeyboardEvent) => void) | null = null;
    private handlerVisibilityChange: (() => void) | null = null;
    private handlerBlur: (() => void) | null = null;
    private handlerFullscreenChange: (() => void) | null = null;
    private handlerPopState: (() => void) | null = null;
    private devToolsIntervalId: ReturnType<typeof setInterval> | null = null;

    // Bandera para evitar que la navegación intencional (ej: enviar examen) dispare violaciones
    private safeExit = false;

    initialize(
        policies: SusieConfig['securityPolicies'],
        onViolation?: (violation: SecurityViolation) => void
    ) {
        this.config = policies;
        this.onViolation = onViolation;

        // Solo ejecutar en el navegador — SSR no tiene acceso a document/window
        if (!isPlatformBrowser(this.platformId)) return;

        if (this.config.preventInspection) {
            this.enableInspectionPrevention();
            this.disableConsole();
            this.enableDevToolsDetection();
        }

        if (this.config.requireFullscreen) {
            this.enableFullscreenEnforcement();
        }

        if (this.config.preventTabSwitch) {
            this.enableTabSwitchDetection();
        }

        if (this.config.preventBackNavigation) {
            this.enableBackNavPrevention();
        }

        if (this.config.preventPageReload) {
            this.enableReloadPrevention();
        }

        // Blur complementa a tab switch: detecta ALT+TAB y ventanas externas que tab switch no cubre
        if (this.config.preventTabSwitch) {
            this.enableBlurDetection();
        }
    }

    /**
     * Marcar salida segura para que la navegación intencional no dispare callbacks de violación
     * (ej: después de enviar el examen o al destruir el componente).
     */
    markSafeExit() {
        this.safeExit = true;
    }

    /**
     * Solicita pantalla completa y detecta si el usuario la abandona.
     * Navegadores bloquean fullscreen sin gesto de usuario, por eso el catch vacío.
     */
    private enableFullscreenEnforcement() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(() => {
                // Navegadores bloquean requestFullscreen sin interacción previa del usuario
            });
        }

        this.handlerFullscreenChange = () => {
            if (!document.fullscreenElement && !this.safeExit) {
                this.emitViolation({
                    type: 'FULLSCREEN_EXIT',
                    message: 'El usuario salió del modo pantalla completa.',
                    timestamp: new Date().toISOString()
                });
            }
        };
        document.addEventListener('fullscreenchange', this.handlerFullscreenChange);
    }

    /**
     * Detecta cambio de pestaña usando la API de Page Visibility.
     * Se activa cuando document.hidden cambia a true (el usuario cambió de pestaña o minimizó).
     */
    private enableTabSwitchDetection() {
        this.handlerVisibilityChange = () => {
            if (document.hidden && !this.safeExit) {
                this.emitViolation({
                    type: 'TAB_SWITCH',
                    message: 'El usuario cambió de pestaña o minimizó la ventana.',
                    timestamp: new Date().toISOString()
                });
            }
        };
        document.addEventListener('visibilitychange', this.handlerVisibilityChange);
    }

    /**
     * Detecta pérdida de foco de la ventana (window.blur).
     * Captura escenarios que visibilitychange no detecta: ALT+TAB a otra app, DevTools separados, etc.
     */
    private enableBlurDetection() {
        this.handlerBlur = () => {
            if (!this.safeExit) {
                this.emitViolation({
                    type: 'FOCUS_LOST',
                    message: 'El usuario perdió el foco de la ventana.',
                    timestamp: new Date().toISOString()
                });
            }
        };
        window.addEventListener('blur', this.handlerBlur);
    }

    /**
     * Previene navegación hacia atrás inyectando estados en el historial.
     * Cada vez que el usuario presiona "atrás", se re-inserta el estado actual.
     */
    private enableBackNavPrevention() {
        history.pushState(null, '', location.href);
        this.handlerPopState = () => {
            history.pushState(null, '', location.href);
        };
        window.addEventListener('popstate', this.handlerPopState);
    }

    /**
     * Muestra diálogo de confirmación al intentar recargar o cerrar la página.
     * El navegador controla el texto del diálogo (por seguridad), pero el return lo activa.
     */
    private enableReloadPrevention() {
        window.onbeforeunload = (e: BeforeUnloadEvent) => {
            if (!this.safeExit) {
                e.preventDefault();
                return '¿Seguro que deseas salir? Se perderá el progreso del examen.';
            }
            return undefined;
        };
    }

    /**
     * Bloquea clic derecho (contextmenu) y atajos de teclado de DevTools.
     * Cubre: F12, Ctrl+Shift+I/J/C (inspeccionar), Ctrl+U (ver código fuente).
     */
    private enableInspectionPrevention() {
        this.handlerContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            return false;
        };
        document.addEventListener('contextmenu', this.handlerContextMenu);

        this.handlerKeydown = (e: KeyboardEvent) => {
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                (e.ctrlKey && e.key === 'u') ||
                (e.ctrlKey && e.key === 'U')
            ) {
                e.preventDefault();
                return false;
            }
            return true;
        };
        document.addEventListener('keydown', this.handlerKeydown);
    }

    /**
     * Anula todos los métodos de console para impedir inspección de logs.
     * Usa cast a unknown→Record porque TypeScript no permite indexar console con strings arbitrarios.
     */
    private disableConsole() {
        const noop = () => { };
        const methods = [
            'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
            'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
            'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
            'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
        ];

        const w = window as unknown as Record<string, Record<string, unknown>>;
        methods.forEach(method => {
            try {
                w['console'][method] = noop;
            } catch (_) { /* algunos métodos pueden ser read-only en ciertos navegadores */ }
        });
    }

    /**
     * Trampa agresiva de debugger que se ejecuta cada 50ms.
     * Si DevTools está abierto, el statement 'debugger' pausa la ejecución >100ms,
     * lo cual permite detectar su presencia y limpiar la consola.
     */
    private enableDevToolsDetection() {
        this.devToolsIntervalId = setInterval(() => {
            const startTime = performance.now();
            (function () { }).constructor('debugger')();
            if (performance.now() - startTime > 100) {
                try { console.clear(); } catch (_) { /* console puede estar anulado */ }
            }
        }, 50);
    }

    /**
     * Salir de pantalla completa de forma segura (cuando el examen termina limpiamente).
     * Marca safeExit primero para que el listener de fullscreenchange no emita violación.
     */
    async exitFullscreen(): Promise<void> {
        this.safeExit = true;
        if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
        }
    }

    /**
     * Emite una violación: actualiza el estado reactivo (signals) y notifica al callback del host.
     * El wrapper usa esto para logear al debug panel y la app host para cancelar el examen.
     */
    private emitViolation(violation: SecurityViolation) {
        this.violationCountSignal.update(c => c + 1);
        this.lastViolationSignal.set(violation);

        if (this.onViolation) {
            this.onViolation(violation);
        }
    }

    /**
     * Limpieza obligatoria de TODOS los event listeners e intervalos.
     * Debe llamarse en ngOnDestroy del componente host para evitar memory leaks
     * y que los handlers sigan activos después de destruir el componente.
     */
    destroy() {
        this.safeExit = true;

        if (this.handlerVisibilityChange) {
            document.removeEventListener('visibilitychange', this.handlerVisibilityChange);
            this.handlerVisibilityChange = null;
        }

        if (this.handlerBlur) {
            window.removeEventListener('blur', this.handlerBlur);
            this.handlerBlur = null;
        }

        if (this.handlerFullscreenChange) {
            document.removeEventListener('fullscreenchange', this.handlerFullscreenChange);
            this.handlerFullscreenChange = null;
        }

        if (this.handlerContextMenu) {
            document.removeEventListener('contextmenu', this.handlerContextMenu);
            this.handlerContextMenu = null;
        }

        if (this.handlerKeydown) {
            document.removeEventListener('keydown', this.handlerKeydown);
            this.handlerKeydown = null;
        }

        if (this.handlerPopState) {
            window.removeEventListener('popstate', this.handlerPopState);
            this.handlerPopState = null;
        }

        if (this.devToolsIntervalId !== null) {
            clearInterval(this.devToolsIntervalId);
            this.devToolsIntervalId = null;
        }

        window.onbeforeunload = null;
    }
}
