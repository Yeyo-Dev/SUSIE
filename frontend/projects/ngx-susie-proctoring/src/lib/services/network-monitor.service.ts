import { Injectable, signal, OnDestroy } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NetworkMonitorService implements OnDestroy {
    isOnline = signal<boolean>(navigator.onLine);

    private handleOnline = () => this.isOnline.set(true);
    private handleOffline = () => this.isOnline.set(false);

    constructor() {
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
    }

    ngOnDestroy() {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
    }
}
