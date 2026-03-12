import { Injectable, NgZone, inject } from '@angular/core';
import { SecurityViolation } from '../models/contracts';

@Injectable({ providedIn: 'root' })
export class SecurityService {
    private policies: any = {};
    private violationCallback?: (v: SecurityViolation) => void;
    private devToolsInterval?: any;
    
    private logger: (type: 'info' | 'error' | 'success', msg: string, details?: any) => void = () => { };

    constructor(private ngZone: NgZone) { }

    setLogger(fn: (type: 'info' | 'error' | 'success', msg: string, details?: any) => void) {
        this.logger = fn;
    }

    enableProtection(policies: any, callback: (v: SecurityViolation) => void) {
        this.policies = policies;
        this.violationCallback = callback;

        if (policies.requireFullscreen) {
            document.addEventListener('fullscreenchange', this.handleFullscreenChange);
        }

        if (policies.preventTabSwitch) {
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
            window.addEventListener('blur', this.handleBlur);
        }

        if (policies.preventInspection) {
            // Polling approach to catch devtools opened via browser UI (menu)
            this.devToolsInterval = setInterval(() => this.checkDevtoolsSize(), 5000);
        }

        if (policies.preventBackNavigation) {
            history.pushState(null, '', window.location.href);
            window.addEventListener('popstate', this.preventBack);
        }

        if (policies.preventPageReload) {
            window.addEventListener('beforeunload', this.preventReload);
        }

        if (policies.preventCopyPaste) {
            ['copy', 'cut', 'paste'].forEach(evt => document.addEventListener(evt, this.preventClipboard));
            document.addEventListener('selectstart', this.preventSelection);
        }
    }

    disableProtection() {
        if (this.devToolsInterval) {
            clearInterval(this.devToolsInterval);
            this.devToolsInterval = undefined;
        }

        document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('blur', this.handleBlur);
        window.removeEventListener('popstate', this.preventBack);
        window.removeEventListener('beforeunload', this.preventReload);

        ['copy', 'cut', 'paste'].forEach(evt => document.removeEventListener(evt, this.preventClipboard));
        document.removeEventListener('selectstart', this.preventSelection);
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



    private reportViolation(type: any, message: string) {
        this.ngZone.run(() => {
            this.violationCallback?.({
                type,
                message,
                timestamp: new Date().toISOString()
            });
        });
    }
}
