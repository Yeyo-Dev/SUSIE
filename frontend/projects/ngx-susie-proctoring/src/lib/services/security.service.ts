import { Injectable, NgZone } from '@angular/core';
import { SecurityViolation } from '../models/contracts';

@Injectable({ providedIn: 'root' })
export class SecurityService {
    private policies: any = {};
    private violationCallback?: (v: SecurityViolation) => void;

    constructor(private ngZone: NgZone) { }

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
            document.addEventListener('contextmenu', this.preventContextMenu);
            document.addEventListener('keydown', this.preventDevTools);
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
            document.addEventListener('contextmenu', this.preventContextMenu); // Re-enforce if not already
        }
    }

    disableProtection() {
        document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('blur', this.handleBlur);
        document.removeEventListener('contextmenu', this.preventContextMenu);
        document.removeEventListener('keydown', this.preventDevTools);
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
                console.error('Error entering fullscreen:', err);
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
        // Blur can trigger on simple interactions sometimes, be careful
        // this.reportViolation('FOCUS_LOST', 'La ventana perdió el foco');
    };

    private preventContextMenu = (e: Event) => {
        e.preventDefault();
        return false;
    };

    private preventDevTools = (e: KeyboardEvent) => {
        // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
            (e.ctrlKey && e.key === 'u')
        ) {
            e.preventDefault();
            this.reportViolation('INSPECTION_ATTEMPT', 'Intento de abrir herramientas de desarrollador');
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
