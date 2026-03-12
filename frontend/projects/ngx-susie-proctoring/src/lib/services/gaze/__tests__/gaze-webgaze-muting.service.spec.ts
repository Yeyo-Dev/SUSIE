import { TestBed } from '@angular/core/testing';
import { GazeWebGazerMutingService } from '../gaze-webgaze-muting.service';

describe('GazeWebGazerMutingService', () => {
  let service: GazeWebGazerMutingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazeWebGazerMutingService],
    });
    service = TestBed.inject(GazeWebGazerMutingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  xit('should mute all WebGazer videos on DOM', () => {
    // TODO: Add tests in Phase 6
    // - Create mock video elements in DOM
    // - Call muteAllVideos()
    // - Verify all videos have muted=true
    // - Verify MutationObserver is set up to catch new videos
  });

  xit('should handle MutationObserver and fallback interval correctly', () => {
    // TODO: Add tests in Phase 6
    // - Mock MutationObserver
    // - Verify startMuting() sets up observer + interval
    // - Verify stopMuting() cleans up both
    // - Verify cleanup on destroy()
  });

  xit('should handle missing WebGazer videos gracefully', () => {
    // TODO: Add tests in Phase 6
    // - Call muteAllVideos() with empty DOM
    // - Verify no errors are thrown
    // - Verify logger is called appropriately
  });
});
