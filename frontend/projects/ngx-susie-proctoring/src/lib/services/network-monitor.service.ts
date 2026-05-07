import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { DestroyRefUtility } from '@lib/utils/destroy-ref.utility';

@Injectable({ providedIn: 'root' })
export class NetworkMonitorService implements OnDestroy {
    isOnline = signal<boolean>(navigator.onLine);
    isReconnecting = signal<boolean>(false);
    reconnectTimeLeft = signal<number>(0);

    // Callbacks del Orquestador
    onCriticalDisconnectTimeout?: () => void;
    
    private reconnectInterval: any;
    private cleanup = inject(DestroyRefUtility);

    constructor() {
        this.cleanup.addEventListener(window, 'online', () => this.handleSuccessConnection());
        this.cleanup.addEventListener(window, 'offline', () => this.triggerConnectionError(0));
    }

    triggerConnectionError(statusCode: number) {
        this.isOnline.set(false);
        if (this.isReconnecting()) return;
        
        this.isReconnecting.set(true);
        this.reconnectTimeLeft.set(30);

        this.reconnectInterval = setInterval(() => {
            const current = this.reconnectTimeLeft() - 1;
            this.reconnectTimeLeft.set(current);

            if (current <= 0) {
                this.clearTimers();
                this.onCriticalDisconnectTimeout?.(); // Echar al alumno post-30s
            }
        }, 1000);
    }

    handleSuccessConnection() {
        this.isOnline.set(true);
        this.clearTimers();
    }

    private clearTimers() {
        this.isReconnecting.set(false);
        this.reconnectTimeLeft.set(0);
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }

    ngOnDestroy() {
        this.clearTimers();
    }
}
