import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { DestroyRefUtility } from '../utils/destroy-ref.utility';

@Injectable({ providedIn: 'root' })
export class NetworkMonitorService implements OnDestroy {
    isOnline = signal<boolean>(navigator.onLine);

    private handleOnline = () => this.isOnline.set(true);
    private handleOffline = () => this.isOnline.set(false);
    private cleanup = inject(DestroyRefUtility);

    constructor() {
        this.cleanup.addEventListener(window, 'online', this.handleOnline);
        this.cleanup.addEventListener(window, 'offline', this.handleOffline);
    }

    ngOnDestroy() {
        this.cleanup.removeEventListener(window, 'online', this.handleOnline);
        this.cleanup.removeEventListener(window, 'offline', this.handleOffline);
    }
}
