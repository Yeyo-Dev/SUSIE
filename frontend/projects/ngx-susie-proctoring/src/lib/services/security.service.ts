import { Injectable, NgZone, inject } from '@angular/core';
import { SecurityViolation, LoggerFn, SecurityPoliciesConfig, IntervalHandle } from '@lib/models/contracts';
import { DestroyRefUtility } from '@lib/utils/destroy-ref.utility';

@Injectable({ providedIn: 'root' })
export class SecurityService {
    private policies: SecurityPoliciesConfig = {} as SecurityPoliciesConfig;
    private violationCallback?: (v: SecurityViolation) => void;
    private devToolsInterval?: IntervalHandle;
    
    private logger: LoggerFn = () => { };

    constructor(
        private ngZone: NgZone,
        private cleanup: DestroyRefUtility
    ) { }

    setLogger(fn: LoggerFn) {
        this.logger = fn;
    }

    enableProtection(policies: SecurityPoliciesConfig, callback: (v: SecurityViolation) => void) {
        this.policies = policies;
        this.violationCallback = callback;

        if (policies.requireFullscreen) {
            this.cleanup.addEventListener(document, 'fullscreenchange', this.handleFullscreenChange);
        }

        if (policies.preventTabSwitch) {
            this.cleanup.addEventListener(document, 'visibilitychange', this.handleVisibilityChange);
            this.cleanup.addEventListener(window, 'blur', this.handleBlur);
        }

        if (policies.preventInspection) {
            // Polling approach to catch devtools opened via browser UI (menu)
            this.devToolsInterval = this.cleanup.setInterval(() => this.checkDevtoolsSize(), 5000);
        }

        if (policies.preventBackNavigation) {
            history.pushState(null, '', window.location.href);
            this.cleanup.addEventListener(window, 'popstate', this.preventBack as EventListener);
        }

        if (policies.preventPageReload) {
            this.cleanup.addEventListener(window, 'beforeunload', this.preventReload);
        }

        if (policies.preventCopyPaste) {
            ['copy', 'cut', 'paste'].forEach(evt => this.cleanup.addEventListener(document, evt, this.preventClipboard));
            this.cleanup.addEventListener(document, 'selectstart', this.preventSelection);
        }
    }

    disableProtection() {
        if (this.devToolsInterval) {
            this.cleanup.clearInterval(this.devToolsInterval);
            this.devToolsInterval = undefined;
        }

        this.cleanup.removeEventListener(document, 'fullscreenchange', this.handleFullscreenChange as EventListener);
        this.cleanup.removeEventListener(document, 'visibilitychange', this.handleVisibilityChange as EventListener);
        this.cleanup.removeEventListener(window, 'blur', this.handleBlur as EventListener);
        this.cleanup.removeEventListener(window, 'popstate', this.preventBack as EventListener);
        this.cleanup.removeEventListener(window, 'beforeunload', this.preventReload as EventListener);

        ['copy', 'cut', 'paste'].forEach(evt => this.cleanup.removeEventListener(document, evt, this.preventClipboard as EventListener));
        this.cleanup.removeEventListener(document, 'selectstart', this.preventSelection as EventListener);
    }


    async enterFullscreen() {
        if (!document.fullscreenElement) {
            try {
                await document.documentElement.requestFullscreen();
            } catch (err) {
                this.logger('error', 'Error entering fullscreen:', err);
            }
        }
    }


    private handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
            this.reportViolation('FULLSCREEN_EXIT', 'El usuario salió del modo pantalla completa');
        }
    };

    private handleVisibilityChange = () => {
        if (document.hidden) {
            this.reportViolation('TAB_SWITCH', 'Usuario cambió de pestaña o minimizó el navegador');
        }
    };

    private handleBlur = () => {
        // Enforce blur detection to catch virtual desktop switching
        this.reportViolation('FOCUS_LOST', 'La ventana del navegador perdió el foco o el usuario cambió de escritorio');
    };

    private preventContextMenu = (e: Event) => {
        e.preventDefault();
        return false;
    };

    private checkDevtoolsSize = () => {
        const threshold = 160;
        // The difference gets huge if devtools opens (docked horizontally or vertically)
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;

        if (widthDiff > threshold || heightDiff > threshold) {
            this.reportViolation('INSPECTION_ATTEMPT', 'Herramientas de desarrollador detectadas abiertas en el navegador');
        }
    };

    private preventBack = (event: PopStateEvent) => {
        history.pushState(null, '', window.location.href);
        this.reportViolation('NAVIGATION_ATTEMPT', 'Intento de navegación hacia atrás');
    };

    private preventReload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = ''; // Standard for Chrome
        this.reportViolation('RELOAD_ATTEMPT', 'Intento de recargar la página');
    };

    private preventClipboard = (e: Event) => {
        e.preventDefault();
        this.reportViolation('CLIPBOARD_ATTEMPT', 'Intento de modificar el portapapeles (Copiar/Pegar)');
    };

    private preventSelection = (e: Event) => {
        e.preventDefault();
        // Silent violation or log it
        // this.reportViolation('SELECTION_ATTEMPT', 'Intento de seleccionar texto');
    };



    private reportViolation(type: SecurityViolation['type'], message: string) {
        this.ngZone.run(() => {
            this.violationCallback?.({
                type,
                message,
                timestamp: new Date().toISOString()
            });
        });
    }
}
