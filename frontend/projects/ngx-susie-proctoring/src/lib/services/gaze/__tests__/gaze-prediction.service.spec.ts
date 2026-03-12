import { TestBed } from '@angular/core/testing';
import { GazePredictionService } from '../gaze-prediction.service';

describe('GazePredictionService', () => {
  let service: GazePredictionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazePredictionService],
    });
    service = TestBed.inject(GazePredictionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  xit('should start tracking with WebGazer instance', () => {
    // TODO: Add tests in Phase 2
    // - Mock WebGazer
    // - Verify startTracking() accepts WebGazer
    // - Verify predictionReceived$ observable emits
    // - Verify setGazeListener() registers callback
  });

  xit('should fallback to manual polling when setGazeListener stops firing', () => {
    // TODO: Add tests in Phase 2
    // - Verify startManualPolling() uses RAF
    // - Verify throttle to ~10 predictions/second
    // - Mock getCurrentPrediction()
  });
});
