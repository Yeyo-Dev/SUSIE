import { Injectable, signal, OnDestroy } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class InactivityService implements OnDestroy {
    showWarning = signal(false);

    private timeoutId: any;
    private warningTimeoutId: any;
    private inactivityLimitMs = 3 * 60 * 1000; // 3 min default
    private onInactivityCallback?: () => void;
    private events = ['mousemove', 'keydown', 'click', 'scroll'];
    private lastActivity = Date.now();
    private checkInterval: any;

    configure(limitMinutes: number, callback?: () => void) {
        if (limitMinutes > 0) {
            this.inactivityLimitMs = limitMinutes * 60 * 1000;
            this.onInactivityCallback = callback;
        }
    }

    startMonitoring() {
        this.stopMonitoring();

        // Listen to user events
        this.events.forEach(event => {
            window.addEventListener(event, this.handleUserActivity, { passive: true });
        });

        // Check periodically
        this.checkInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - this.lastActivity;

            // Warning logic: Show warning if 90% of time passed
            if (!this.showWarning() && elapsed > this.inactivityLimitMs * 0.9) {
                this.showWarning.set(true);
            }

            // Timeout logic
            if (elapsed > this.inactivityLimitMs) {
                this.handleTimeout();
            }
        }, 5000);
    }

    stopMonitoring() {
        this.events.forEach(event => {
            window.removeEventListener(event, this.handleUserActivity);
        });
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.showWarning.set(false);
    }

    resetTimer() {
        this.showWarning.set(false);
        this.lastActivity = Date.now();
    }

    private handleUserActivity = () => {
        // Only reset if not already in warning state (force user to click "I'm here")
        // Or maybe reset automatically? Let's reset automatically unless warning is shown?
        // User requirement typically implies explicit confirmation if warning is shown.
        if (!this.showWarning()) {
            this.lastActivity = Date.now();
        }
    };

    private handleTimeout() {
        this.onInactivityCallback?.();
        // Reset to avoid multiple triggers? Or keep triggering?
        this.resetTimer();
    }

    ngOnDestroy() {
        this.stopMonitoring();
    }
}
