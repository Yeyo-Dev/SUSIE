import { Injectable } from '@angular/core';
import { KalmanFilter } from '@lib/utils/kalman-filter';
import { GazePoint, GazeLoggerFn } from './gaze.interfaces';

/**
 * Aplica Kalman filtering + sliding window averaging sobre coordenadas de gaze.
 * Convierte coordenadas de píxeles (absolutas) en valores normalizados [-1, 1].
 */
@Injectable({ providedIn: 'root' })
export class SignalSmoothingService {
    private kalmanX = new KalmanFilter(0.02, 0.8, 0.1);
    private kalmanY = new KalmanFilter(0.02, 0.8, 0.1);
    private xHistory: number[] = [];
    private yHistory: number[] = [];
    private smoothingWindow = 10;
    private lastValidX: number | null = null;
    private lastValidY: number | null = null;
    // Last smoothed result for outlier rejection (normalized values)
    private lastSmoothedResult: GazePoint | null = null;

    configure(smoothingWindow: number): void {
        this.smoothingWindow = smoothingWindow;
    }

    /**
     * Procesa coordenadas crudas de gaze y devuelve un GazePoint suavizado y normalizado.
     * @param rawX Coordenada X en píxeles
     * @param rawY Coordenada Y en píxeles
     * @param confidence Confianza opcional de la medición (0-1), pasada al Kalman filter
     * @returns Punto normalizado con Kalman + sliding window, o null si datos inválidos
     */
    process(rawX: number, rawY: number, confidence?: number): GazePoint | null {
        if (rawX == null || rawY == null || isNaN(rawX) || isNaN(rawY)) {
            return null;
        }

        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;

        // Outlier rejection: si hay punto previo, verificar si el nuevo está dentro del umbral
        // Primer frame siempre pasa (no hay historial para comparar)
        if (this.lastValidX !== null && this.lastValidY !== null) {
            if (this.isOutlier(rawX, rawY, this.lastValidX, this.lastValidY, w, h)) {
                // Es outlier: descartar frame y retornar último resultado válido
                // NO actualizar Kalman ni el historial
                return this.lastSmoothedResult;
            }
        }

        // Punto válido: actualizar último punto crudo válido
        this.lastValidX = rawX;
        this.lastValidY = rawY;

        // Normalizar a [-1, 1]: 0 = centro, -1 = izquierda/arriba, 1 = derecha/abajo
        const normalX = (rawX / w) * 2 - 1;
        const normalY = (rawY / h) * 2 - 1;

        // Aplicar Kalman
        const kx = this.kalmanX.update(normalX, confidence);
        const ky = this.kalmanY.update(normalY, confidence);

        // Añadir al sliding window
        this.xHistory.push(kx);
        this.yHistory.push(ky);

        if (this.xHistory.length > this.smoothingWindow) {
            this.xHistory.shift();
            this.yHistory.shift();
        }

        // Promedio ponderado lineal del window (newer = mayor peso)
        const avgX = this.linearWeightedAverage(this.xHistory);
        const avgY = this.linearWeightedAverage(this.yHistory);

        const result: GazePoint = {
            x: parseFloat(avgX.toFixed(3)),
            y: parseFloat(avgY.toFixed(3)),
            ts: Date.now(),
        };

        // Guardar último resultado suavizado para retorno en caso de outlier
        this.lastSmoothedResult = result;

        return result;
    }

    /**
     * Reinicia los filtros y el historial.
     * Llamar al recuperar el rostro para evitar arrastre de posición previa.
     */
    reset(): void {
        this.kalmanX.reset();
        this.kalmanY.reset();
        this.xHistory = [];
        this.yHistory = [];
        this.lastValidX = null;
        this.lastValidY = null;
        this.lastSmoothedResult = null;
    }

    /**
     * Verifica si un punto es un outlier basándose en la distancia respecto al último
     * estimado válido. Un outlier es aquel que se desvía más del 30% de la diagonal de pantalla.
     * @param x Coordenada X actual en píxeles
     * @param y Coordenada Y actual en píxeles
     * @param lastX Última coordenada X válida en píxeles
     * @param lastY Última coordenada Y válida en píxeles
     * @param screenWidth Ancho de pantalla en píxeles
     * @param screenHeight Alto de pantalla en píxeles
     * @returns true si es outlier, false si está dentro del umbral
     */
    private isOutlier(
        x: number,
        y: number,
        lastX: number,
        lastY: number,
        screenWidth: number,
        screenHeight: number
    ): boolean {
        const screenDiag = Math.sqrt(screenWidth ** 2 + screenHeight ** 2);
        const distance = Math.sqrt((x - lastX) ** 2 + (y - lastY) ** 2);
        const threshold = 0.3 * screenDiag;
        return distance > threshold;
    }

    /**
     * Calcula el promedio ponderado lineal de un array de valores.
     * Los valores más recientes (últimos en el array) tienen mayor peso.
     *
     * Fórmula: weight[i] = (i + 1) / sum(1..N)
     * donde i es la posición (oldest=0, newest=N-1)
     *
     * Ejemplo para window size 3:
     * - Weights: [1, 2, 3] (oldest to newest)
     * - Normalized: [1/6, 2/6, 3/6]
     * - Window [10, 20, 30] → (10*1 + 20*2 + 30*3) / 6 = 23.33
     *
     * @param values Array de valores (ordered oldest to newest)
     * @returns Promedio ponderado
     */
    private linearWeightedAverage(values: number[]): number {
        if (values.length === 0) return 0;
        if (values.length === 1) return values[0];

        // Suma de 1 a N = N * (N + 1) / 2
        const n = values.length;
        const weightSum = (n * (n + 1)) / 2;

        // weight[i] = (i + 1), posición más reciente tiene mayor peso
        let weightedSum = 0;
        for (let i = 0; i < n; i++) {
            weightedSum += values[i] * (i + 1);
        }

        return weightedSum / weightSum;
    }
}
