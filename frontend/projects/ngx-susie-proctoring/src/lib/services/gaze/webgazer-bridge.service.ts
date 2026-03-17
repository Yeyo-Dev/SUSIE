import { Injectable, inject, NgZone } from '@angular/core';
import { GazeLoggerFn, RawGazeEvent } from './gaze.interfaces';

type RawGazeListener = (event: RawGazeEvent) => void;
type NoFaceListener = () => void;

/**
 * Encapsula todo acceso a la librería global WebGazer.
 * Responsabilidades:
 * - Acceso a window.webgazer
 * - Configurar tracker y regression
 * - Llamar begin() con monkey-patch de getUserMedia
 * - Registrar el gaze listener y emitir eventos normalizados
 * - Limpiar la cámara en stop()
 */
@Injectable({ providedIn: 'root' })
export class WebGazerBridgeService {
    private ngZone = inject(NgZone);
    private logger: GazeLoggerFn = () => {};
    private webgazer: any = null;
    private gazeListener: RawGazeListener | null = null;
    private noFaceListener: NoFaceListener | null = null;

    /** Referencia pública para que otros servicios puedan llamar métodos de WebGazer */
    get instance(): any {
        return this.webgazer;
    }

    configure(logger: GazeLoggerFn): void {
        this.logger = logger;
    }

    /**
     * Registra el callback que recibe datos de gaze crudos.
     */
    onGaze(listener: RawGazeListener): void {
        this.gazeListener = listener;
    }

    /**
     * Registra el callback que se ejecuta cuando WebGazer no detecta rostro (data=null).
     */
    onNoFace(listener: NoFaceListener): void {
        this.noFaceListener = listener;
    }

    /**
     * Inicializa y arranca WebGazer.
     * @param existingStream Si se provee, se monkey-patchea getUserMedia para reusar el stream.
     * @returns true si se inició exitosamente, false si WebGazer no está disponible.
     */
    async begin(existingStream?: MediaStream | null): Promise<boolean> {
        this.webgazer = (window as any).webgazer;

        if (!this.webgazer) {
            this.logger('error', '❌ WebGazer no está cargado. Incluí webgazer.js en la aplicación.');
            console.error('[GAZE-BRIDGE] window.webgazer no disponible');
            return false;
        }

        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

        if (existingStream) {
            this.logger('info', '🔗 Inyectando stream existente en WebGazer...');
            navigator.mediaDevices.getUserMedia = () => Promise.resolve(existingStream);
        }

        this.webgazer.setTracker('TFFacemesh');

        // Try weightedRidge first (better precision), fall back to ridge
        try {
            this.webgazer.setRegression('weightedRidge');
            this.logger('info', '✅ WebGazer usando weightedRidge');
        } catch (e) {
            console.warn('[GAZE-BRIDGE] weightedRidge no disponible, usando ridge:', e);
            this.logger('warn', '⚠️ weightedRidge no disponible, usando ridge fallback');
            this.webgazer.setRegression('ridge');
        }

        this.webgazer.setGazeListener((data: any, _clock: number) => {
            if (!data) {
                this.noFaceListener?.();
                return;
            }

            const confidence = data.confidence ?? data.estimation?.confidence ?? null;
            this.gazeListener?.({
                rawX: data.x,
                rawY: data.y,
                confidence,
                rawData: data,
            });
        });

        console.log('[GAZE-BRIDGE] Llamando webgazer.begin()...');
        await this.webgazer.begin();

        // Restaurar getUserMedia original
        navigator.mediaDevices.getUserMedia = originalGetUserMedia;

        this.logger('info', '✅ WebGazer.begin() completado');
        console.log('[GAZE-BRIDGE] ✅ webgazer.begin() completado');
        return true;
    }

    /**
     * Intenta llamar webgazer.resume() (útil post-calibración).
     */
    resume(): void {
        try {
            if (typeof this.webgazer?.resume === 'function') {
                this.webgazer.resume();
                console.log('[GAZE-BRIDGE] webgazer.resume() OK');
            }
        } catch (e) {
            console.warn('[GAZE-BRIDGE] webgazer.resume() falló:', e);
        }
    }

    /**
     * Configura el video de WebGazer (show/hide preview y overlays).
     */
    configureVideo(showPreview: boolean, showPrediction: boolean, showFaceOverlay: boolean): void {
        try {
            this.webgazer
                ?.showVideoPreview(showPreview)
                ?.showPredictionPoints(showPrediction)
                ?.showFaceOverlay(showFaceOverlay);
        } catch (e) {
            console.warn('[GAZE-BRIDGE] Error al configurar video preview:', e);
        }
    }

    /** Muestra/oculta el video de WebGazer */
    showVideo(show: boolean): void {
        try {
            this.webgazer?.showVideo(show);
        } catch (e) {
            console.warn('[GAZE-BRIDGE] showVideo falló:', e);
        }
    }

    /** Muestra/oculta el face overlay */
    showFaceOverlay(show: boolean): void {
        try {
            this.webgazer?.showFaceOverlay(show);
        } catch (e) {
            // ignore
        }
    }

    /**
     * Detiene WebGazer, cierra la cámara y limpia el estado interno.
     */
    stop(): void {
        if (!this.webgazer) return;

        try {
            // Detener tracks de cámara primero
            const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
            if (videoEl?.srcObject instanceof MediaStream) {
                videoEl.srcObject.getTracks().forEach(t => t.stop());
            } else if (this.webgazer.util?.getMediaStream) {
                const stream = this.webgazer.util.getMediaStream();
                stream?.getTracks().forEach((t: any) => t.stop());
            }

            this.webgazer.end();
        } catch (e) {
            console.warn('[GAZE-BRIDGE] Error al detener WebGazer:', e);
        }

        this.webgazer = null;
        this.gazeListener = null;
        this.noFaceListener = null;
    }
}
