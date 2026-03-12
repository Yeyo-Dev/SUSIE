import { TestBed } from '@angular/core/testing';
import { GazeSmoothingService } from '../gaze-smoothing.service';

describe('GazeSmoothingService', () => {
  let service: GazeSmoothingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazeSmoothingService],
    });
    service = TestBed.inject(GazeSmoothingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  xit('should normalize and smooth pixel coordinates to [-1, 1] range', () => {
    // TODO: Add tests in Phase 3
    // - Verify pixel scaling: (x / width) * 2 - 1
    // - Verify smoothing window size
    // - Verify output normalization
    // - Test edge cases: (0, 0), (width, height), (width/2, height/2)
  });

  xit('should maintain sliding window history correctly', () => {
    // TODO: Add tests in Phase 3
    // - Verify xHistory and yHistory accumulation
    // - Verify window size enforcement
    // - Verify reset() clears history
    // - Test average calculation with empty history
  });
});
