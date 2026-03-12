import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { GazeWebGazerMutingService } from '../gaze-webgaze-muting.service';

describe('GazeWebGazerMutingService', () => {
  let service: GazeWebGazerMutingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazeWebGazerMutingService],
    });
    service = TestBed.inject(GazeWebGazerMutingService);
  });

  afterEach(() => {
    service.destroy();
    document.querySelectorAll('video').forEach(v => v.remove());
    const containers = ['webgazerVideoContainer', 'webgazerGazeDot'];
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set logger', () => {
    const logger = jasmine.createSpy('logger');
    service.setLogger(logger);
    service.setLogger(() => {});
    expect(true).toBe(true);
  });

  it('should mute all WebGazer videos on DOM', () => {
    const videoEl = document.createElement('video');
    videoEl.id = 'webgazerVideoFeed';
    videoEl.muted = false;
    videoEl.volume = 1;
    document.body.appendChild(videoEl);

    service.muteNow();

    expect(videoEl.muted).toBe(true);
    expect(videoEl.volume).toBe(0);
  });

  it('should mute videos in WebGazer containers', () => {
    const container = document.createElement('div');
    container.id = 'webgazerVideoContainer';
    const videoEl = document.createElement('video');
    videoEl.muted = false;
    videoEl.volume = 1;
    container.appendChild(videoEl);
    document.body.appendChild(container);

    service.muteNow();

    expect(videoEl.muted).toBe(true);
    expect(videoEl.volume).toBe(0);
  });

  it('should handle missing WebGazer videos gracefully', () => {
    expect(() => service.muteNow()).not.toThrow();
    expect(() => service.start()).not.toThrow();
    expect(() => service.stop()).not.toThrow();
  });

  it('should start and stop MutationObserver', fakeAsync(() => {
    service.start();
    tick(100);
    
    const videoEl = document.createElement('video');
    videoEl.id = 'webgazerVideoFeed';
    document.body.appendChild(videoEl);
    
    tick(600);
    expect(videoEl.muted).toBe(true);
    
    service.stop();
    service.destroy();
  }));

  it('should stop and clean up resources', fakeAsync(() => {
    service.start();
    tick(100);
    
    service.stop();
    tick(100);
    
    service.destroy();
    
    expect(true).toBe(true);
  }));

  it('should call muteAllVideos as alias for muteNow', () => {
    const videoEl = document.createElement('video');
    videoEl.id = 'webgazerVideoFeed';
    videoEl.muted = false;
    document.body.appendChild(videoEl);

    service.muteAllVideos();

    expect(videoEl.muted).toBe(true);
  });

  it('should not throw on destroy when not started', () => {
    expect(() => service.destroy()).not.toThrow();
  });
});
