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
    }

    disableProtection() {
        document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('blur', this.handleBlur);
        document.removeEventListener('contextmenu', this.preventContextMenu);
        document.removeEventListener('keydown', this.preventDevTools);
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
