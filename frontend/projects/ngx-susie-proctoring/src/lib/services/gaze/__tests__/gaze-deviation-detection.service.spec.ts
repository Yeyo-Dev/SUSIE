import { TestBed } from '@angular/core/testing';
import { GazeDeviationDetectionService } from '../gaze-deviation-detection.service';

describe('GazeDeviationDetectionService', () => {
  let service: GazeDeviationDetectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazeDeviationDetectionService],
    });
    service = TestBed.inject(GazeDeviationDetectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  xit('should detect sustained gaze deviation', () => {
    // TODO: Add tests in Phase 5
    // - Create mock GazePoints outside threshold
    // - Verify deviationDetected$ emits after tolerance period
    // - Verify deviationResolved$ emits when gaze returns to screen
  });

  xit('should handle threshold configuration', () => {
    // TODO: Add tests in Phase 5
    // - Test setDeviationThreshold()
    // - Verify threshold is applied correctly
    // - Test edge cases (0, 1, negative values)
  });

  xit('should calculate deviation duration correctly', () => {
    // TODO: Add tests in Phase 5
    // - Verify getDeviationDuration() returns correct elapsed time
    // - Verify duration resets when gaze returns
  });
});
