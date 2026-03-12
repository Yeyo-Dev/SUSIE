import { TestBed } from '@angular/core/testing';
import { GazeCalibrationService } from '../gaze-calibration.service';

describe('GazeCalibrationService', () => {
  let service: GazeCalibrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazeCalibrationService],
    });
    service = TestBed.inject(GazeCalibrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  xit('should initialize WebGazer and complete calibration', () => {
    // TODO: Add tests in Phase 1
    // - Mock WebGazer
    // - Verify startCalibration() initializes correctly
    // - Verify recordCalibrationClick() logs appropriately
    // - Verify completeCalibration() returns WebGazer instance
  });

  xit('should handle WebGazer initialization errors gracefully', () => {
    // TODO: Add tests in Phase 1
    // - Test missing WebGazer
    // - Test getUserMedia failures
  });
});
