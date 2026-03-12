import { TestBed } from '@angular/core/testing';
import { GazeMetricsService } from '../gaze-metrics.service';

describe('GazeMetricsService', () => {
  let service: GazeMetricsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazeMetricsService],
    });
    service = TestBed.inject(GazeMetricsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  xit('should accumulate points in buffer with size limit', () => {
    // TODO: Add tests in Phase 4
    // - Verify recordPoint() adds to buffer
    // - Verify buffer respects maxBufferSize
    // - Verify oldest points are removed when full
    // - Test flushBuffer() returns all and clears
  });

  xit('should calculate basic metrics (min/max/avg)', () => {
    // TODO: Add tests in Phase 4
    // - Test getMetrics() with various point sets
    // - Verify stat calculations
    // - Test empty buffer edge case
  });
});
