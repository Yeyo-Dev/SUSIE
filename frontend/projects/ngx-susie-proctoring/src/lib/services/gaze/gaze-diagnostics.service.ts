import { Injectable, inject } from '@angular/core';
import { GazeLoggerFn, GazeState } from './gaze.interfaces';
import { LoggerService } from '../logger.service';

/**
 * Monitorea la salud del pipeline de gaze tracking.
 * Detecta cuando WebGazer deja de enviar datos durante el tracking activo.
 */
@Injectable({ providedIn: 'root' })
export class GazeDiagnosticsService {
    private diagnosticInterval: ReturnType<typeof setInterval> | null = null;
    private loggerService = inject(LoggerService);
    private logger: GazeLoggerFn = () => {};

    configure(logger: GazeLoggerFn): void {
        this.logger = logger;
    }

    /**
     * Inicia el loop de diagnóstico.
     * @param getFrameCount Callback que devuelve el frame count actual
     * @param getState Callback que devuelve el GazeState actual
     */
    start(
        getFrameCount: () => number,
        getState: () => GazeState
    ): void {
        this.stop();

        let lastCheckedFrameCount = getFrameCount();
        // Si el frame count inicial es null/undefined, usar 0 por defecto
        if (lastCheckedFrameCount == null) {
            lastCheckedFrameCount = 0;
        }

        this.diagnosticInterval = setInterval(() => {
            const currentFrames = getFrameCount();
            // Saltar verificación si el frame count no está disponible
            if (currentFrames == null) {
                return;
            }

            const newFrames = currentFrames - lastCheckedFrameCount;
            lastCheckedFrameCount = currentFrames;

            if (newFrames === 0 && getState() === 'TRACKING') {
                this.logger('error', '⚠️ WebGazer no envía datos de gaze (pipeline detenido)');
                this.loggerService.warn('Pipeline detenido — frames recibidos en últimos 10s: 0');
            }
        }, 10_000);
    }

    /** Detiene el loop de diagnóstico. */
    stop(): void {
        if (this.diagnosticInterval) {
            clearInterval(this.diagnosticInterval);
            this.diagnosticInterval = null;
        }
    }
}
