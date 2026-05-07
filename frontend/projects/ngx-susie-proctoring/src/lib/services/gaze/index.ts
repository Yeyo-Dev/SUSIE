// Exports tipo barrel para el subsistema de Gaze
// Los consumidores importan GazeTrackingService desde aquí — mismo token que el monolito

export { GazeTrackingFacadeService, GazeTrackingService } from './gaze-tracking.facade';

// Sub-servicios (para testing o uso avanzado)
export { WebGazerBridgeService } from './webgazer-bridge.service';
export { CalibrationService } from './calibration.service';
export { SignalSmoothingService } from './signal-smoothing.service';
export { FaceDetectionService } from './face-detection.service';
export { DeviationDetectionService } from './deviation-detection.service';
export { HeadPoseAnalyzerService } from './head-pose-analyzer.service';
export { DomManagerService } from './dom-manager.service';
export { GazeDiagnosticsService } from './gaze-diagnostics.service';

// Tipos compartidos
export type {
    GazePoint,
    GazeState,
    GazeConfig,
    GazeCalibrationMetrics,
    RawGazeEvent,
    GazeLoggerFn,
} from './gaze.interfaces';

