import { Injectable, signal, inject, computed } from '@angular/core';
import { GazeTrackingFacade, GazePoint, GazeState, GazeConfig } from './gaze/gaze-tracking.facade';

export type { GazePoint, GazeState, GazeConfig };

/**
 * @deprecated Use GazeTrackingFacade instead. This service is a backward-compatibility wrapper.
 */
@Injectable({ providedIn: 'root' })
export class GazeTrackingService {
    private readonly facade = inject(GazeTrackingFacade);

    readonly gazeState = this.facade.gazeState;
    readonly isCalibrated = this.facade.isCalibrated;
    readonly lastPoint = this.facade.lastPoint;
    readonly hasDeviation = computed(() => this.facade.hasDeviation());

    configure(
        config?: Partial<GazeConfig>,
        logger?: (type: 'info' | 'success' | 'error' | 'warn', message: string, data?: unknown) => void,
        onDeviation?: () => void
    ) {
        this.facade.configure(config, logger, onDeviation);
    }

    async startCalibration(existingStream?: MediaStream | null): Promise<boolean> {
        return this.facade.startCalibration(existingStream);
    }

    recordCalibrationClick(screenX: number, screenY: number) {
        this.facade.recordCalibrationClick(screenX, screenY);
    }

    async completeCalibration() {
        return this.facade.completeCalibration();
    }

    flushGazeBuffer(): GazePoint[] {
        return this.facade.flushGazeBuffer();
    }

    getGazeBuffer(): GazePoint[] {
        return this.facade.getGazeBuffer();
    }

    stop() {
        this.facade.stop();
    }
}
