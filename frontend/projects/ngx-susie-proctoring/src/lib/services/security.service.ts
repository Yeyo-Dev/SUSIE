import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SusieConfig } from '../models/contracts';

@Injectable({
    providedIn: 'root'
})
export class SecurityService {
    private config: SusieConfig['securityPolicies'] | undefined;
    private platformId = inject(PLATFORM_ID);

    initialize(policies: SusieConfig['securityPolicies']) {
        this.config = policies;

        if (isPlatformBrowser(this.platformId)) {
            if (this.config.preventInspection) {
                this.enableInspectionPrevention();
                this.disableConsole(); // NEW: Console Nullification
                this.enableDevToolsDetection();
            }
        }
    }

    private disableConsole() {
        // Nullify all console methods
        const noop = () => { };
        const methods = [
            'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
            'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
            'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
            'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
        ];

        // Cast window to any to bypass strict type checking for console override
        const w = window as any;

        methods.forEach(method => {
            try {
                w.console[method] = noop;
            } catch (e) { }
        });
    }

    private enableDevToolsDetection() {
        // Aggressive "Debugger Trap"
        setInterval(() => {
            const startTime = performance.now();

            // Obfuscated debugger call
            (function () { }).constructor("debugger")();

            if (performance.now() - startTime > 100) {
                // Attempt to clear console if they managed to restore it (unlikely but safe)
                try { console.clear(); } catch (e) { }
            }
        }, 50); // Reduced to 50ms
    }

    private enableTabSwitchDetection() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.warn('SUSIE: Tab switch detected! Focus lost.');
                alert('Advertencia: Has cambiado de pestaña. Esto está prohibido durante el examen.');
                // TODO: Send event to evidence service
            }
        });

        window.addEventListener('blur', () => {
            console.warn('SUSIE: Window focus lost.');
            // blur can be too aggressive (e.g. clicking an alert), so maybe just log or show toast
        });
    }

    private enableInspectionPrevention() {
        // Disable Right Click
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
        document.addEventListener('keydown', (e) => {
            if (
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
                (e.ctrlKey && e.key === 'u')
            ) {
                e.preventDefault();
                return false;
            }
            return true;
        });
    }
}
