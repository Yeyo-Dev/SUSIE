import { Injectable } from '@angular/core';
import { GazeLoggerFn } from './gaze.interfaces';

export interface HeadPoseResult {
    isProfile: boolean;
    /** 'yaw' | 'pitch' | null */
    reason: string | null;
    normalizedX: number | null;
    normalizedY: number | null;
}

/**
 * Analiza la posición de los landmarks faciales de TFFacemesh
 * para detectar cuando el usuario gira la cabeza (yaw/pitch excesivo).
 */
@Injectable({ providedIn: 'root' })
export class HeadPoseAnalyzerService {
    private logger: GazeLoggerFn = () => {};
    private lastProfileLogTime = 0;

    configure(logger: GazeLoggerFn): void {
        this.logger = logger;
    }

    /**
     * Analiza un frame de FaceMesh y detecta si la cabeza está en perfil.
     * @param rawData Datos crudos de WebGazer (contiene allPredictions)
     * @returns HeadPoseResult con isProfile=true si se detecta perfil
     */
    analyze(rawData: any): HeadPoseResult {
        const noProfile: HeadPoseResult = { isProfile: false, reason: null, normalizedX: null, normalizedY: null };

        try {
            const predictions = rawData?.allPredictions;
            if (!predictions?.length) return noProfile;

            const mesh = predictions[0]?.scaledMesh;
            if (!mesh?.length) return noProfile;

            // landmark 1 = punta de nariz
            // landmarks 234, 454 = extremos laterales de la cara
            // landmarks 10, 152 = tope y base de la cara
            const nose = mesh[1];
            const leftEdge = mesh[234];
            const rightEdge = mesh[454];
            const topEdge = mesh[10];
            const bottomEdge = mesh[152];

            if (!nose || !leftEdge || !rightEdge || !topEdge || !bottomEdge) return noProfile;

            const faceWidth = Math.abs(rightEdge[0] - leftEdge[0]);
            const faceHeight = Math.abs(bottomEdge[1] - topEdge[1]);

            if (faceWidth < 10 || faceHeight < 10) return noProfile;

            const noseRelX = (nose[0] - leftEdge[0]) / faceWidth;
            const noseRelY = (nose[1] - topEdge[1]) / faceHeight;

            // Yaw: nariz muy a la derecha o izquierda de la cara
            if (noseRelX < 0.23 || noseRelX > 0.77) {
                const now = Date.now();
                if (now - this.lastProfileLogTime > 3000) {
                    this.lastProfileLogTime = now;
                    this.logger('warn', `⚠️ Perfil detectado — Yaw noseRelX: ${noseRelX.toFixed(2)}`);
                    console.log(`[GAZE-POSE] Perfil Yaw: noseRelX=${noseRelX.toFixed(2)}`);
                }
                return { isProfile: true, reason: 'yaw', normalizedX: noseRelX, normalizedY: noseRelY };
            }

            // Pitch: nariz muy arriba o muy abajo
            if (noseRelY < 0.25 || noseRelY > 0.64) {
                const now = Date.now();
                if (now - this.lastProfileLogTime > 3000) {
                    this.lastProfileLogTime = now;
                    this.logger('warn', `⚠️ Perfil detectado — Pitch noseRelY: ${noseRelY.toFixed(2)}`);
                    console.log(`[GAZE-POSE] Perfil Pitch: noseRelY=${noseRelY.toFixed(2)}`);
                }
                return { isProfile: true, reason: 'pitch', normalizedX: noseRelX, normalizedY: noseRelY };
            }

            return noProfile;
        } catch {
            return noProfile;
        }
    }
}
