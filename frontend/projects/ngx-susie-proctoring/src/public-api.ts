/*
 * Public API Surface of ngx-susie-proctoring
 */

export * from './lib/models/contracts';
export * from './lib/services/media.service';
export * from './lib/services/evidence.service';
export * from './lib/services/evidence-queue.service';
export * from './lib/components/consent-dialog/consent-dialog.component';
export * from './lib/components/susie-wrapper/susie-wrapper.component';
export * from './lib/components/camera-pip/camera-pip.component';
export * from './lib/services/security.service';
export * from './lib/services/exam-config.service';
export * from './lib/components/step-indicator/step-indicator.component';
export * from './lib/components/exam-briefing/exam-briefing.component';

// Gaze Tracking Services
// Facade service (re-exports types: GazePoint, GazeState, GazeConfig)
export * from './lib/services/gaze-tracking.service';

// Sub-services (Calibration, Prediction, Smoothing, Metrics, Deviation, Muting)
export {
  GazeCalibrationService,
  GazePredictionService,
  GazeSmoothingService,
  GazeMetricsService,
  GazeDeviationDetectionService,
  GazeWebGazerMutingService,
} from './lib/services/gaze';

