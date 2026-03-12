/**
 * Gaze Tracking Services - Sub-servicios descompuestos
 *
 * Exporta todos los servicios de gaze tracking para uso en el Facade.
 * Cada servicio tiene una responsabilidad única y clara.
 *
 * Arquitectura:
 * - GazeCalibrationService: Calibración inicial
 * - GazePredictionService: Captura de predicciones en tiempo real
 * - GazeSmoothingService: Normalización y suavizado de coordenadas
 * - GazeMetricsService: Almacenamiento y agregación de puntos
 * - GazeDeviationDetectionService: Detección de desviaciones
 * - GazeWebGazerMutingService: Workaround para muting de videos
 *
 * El Facade (GazeTrackingService) orquesta estos servicios.
 */

export { GazeCalibrationService } from './gaze-calibration.service';
export { GazePredictionService } from './gaze-prediction.service';
export { GazeSmoothingService, type GazePoint } from './gaze-smoothing.service';
export { GazeMetricsService } from './gaze-metrics.service';
export { GazeDeviationDetectionService } from './gaze-deviation-detection.service';
export { GazeWebGazerMutingService } from './gaze-webgaze-muting.service';
