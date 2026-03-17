// Barrel exports for the Gaze subsystem
// Consumers import GazeTrackingService from here — same token as the monolith

export { GazeTrackingFacadeService, GazeTrackingService } from './gaze-tracking.facade';

// Sub-services (for testing or advanced usage)
export { WebGazerBridgeService } from './webgazer-bridge.service';
export { CalibrationService } from './calibration.service';
export { SignalSmoothingService } from './signal-smoothing.service';
export { FaceDetectionService } from './face-detection.service';
export { DeviationDetectionService } from './deviation-detection.service';
export { HeadPoseAnalyzerService } from './head-pose-analyzer.service';
export { DomManagerService } from './dom-manager.service';
export { GazeDiagnosticsService } from './gaze-diagnostics.service';

// Shared types
export type {
    GazePoint,
    GazeState,
    GazeConfig,
    GazeCalibrationMetrics,
    RawGazeEvent,
    GazeLoggerFn,
} from './gaze.interfaces';

