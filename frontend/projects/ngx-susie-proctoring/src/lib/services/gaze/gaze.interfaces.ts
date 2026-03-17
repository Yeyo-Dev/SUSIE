/** Coordenada suavizada de gaze tracking */
export interface GazePoint {
    x: number; // -1 (izquierda) a 1 (derecha), 0 = centro
    y: number; // -1 (arriba) a 1 (abajo), 0 = centro
    ts: number; // timestamp epoch ms
}

/** Estado del servicio de gaze */
export type GazeState = 'IDLE' | 'CALIBRATING' | 'TRACKING' | 'ERROR';

/** Configuración del gaze tracking */
export interface GazeConfig {
    /** Cantidad de frames para promediar (suavizado) */
    smoothingWindow: number;
    /** Umbral normalizado: si |x| o |y| > threshold, se considera "fuera de pantalla" */
    deviationThreshold: number;
    /** Segundos consecutivos fuera del umbral para emitir GAZE_DEVIATION */
    deviationToleranceSeconds: number;
    /** Intervalo en ms para muestrear el buffer de coordenadas */
    samplingIntervalMs: number;
}

/** Métricas de calibración para verificar efectividad */
export interface GazeCalibrationMetrics {
    /** Total de clicks de calibración registrados */
    calibrationClicks: number;
    /** Frames de gaze procesados durante calibración */
    calibrationFrames: number;
    /** Frames de gaze procesados durante tracking */
    trackingFrames: number;
    /** Si WebGazer detectó cara exitosamente */
    faceDetected: boolean;
    /** Promedio de confianza de predicción (si está disponible) */
    avgConfidence: number | null;
    /** Timestamp de inicio de calibración */
    calibrationStartTime: number | null;
    /** Timestamp de completado de calibración */
    calibrationCompleteTime: number | null;
}

/** Evento de gaze crudo emitido por WebGazer */
export interface RawGazeEvent {
    rawX: number;
    rawY: number;
    confidence: number | null;
    /** Objeto completo devuelto por WebGazer (incluye allPredictions para FaceMesh) */
    rawData: any;
}

/** Tipo de función de logging para el sistema de gaze */
export type GazeLoggerFn = (
    type: 'info' | 'error' | 'success' | 'warn',
    msg: string,
    details?: any
) => void;
