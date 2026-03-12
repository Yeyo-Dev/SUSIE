import { TestBed } from '@angular/core/testing';
import { GazePredictionService } from '../gaze-prediction.service';
import { WebGazerAPI, WebGazerPrediction } from '@lib/models/contracts';

describe('GazePredictionService', () => {
  let service: GazePredictionService;
  let mockWebgazer: WebGazerAPI;
  let mockSetGazeListener: jasmine.Spy;
  let mockGetCurrentPrediction: jasmine.Spy;
  let rafCallbacks: FrameRequestCallback[] = [];
  let rafIds = 0;

  beforeEach(() => {
    rafCallbacks = [];
    
    mockSetGazeListener = jasmine.createSpy('setGazeListener');
    mockGetCurrentPrediction = jasmine.createSpy('getCurrentPrediction')
      .and.returnValue({ x: 100, y: 200 });
    
    mockWebgazer = {
      setGazeListener: mockSetGazeListener,
      getCurrentPrediction: mockGetCurrentPrediction,
      end: jasmine.createSpy('end'),
    } as unknown as WebGazerAPI;

    spyOn(window, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafIds;
    });
    spyOn(window, 'cancelAnimationFrame');

    TestBed.configureTestingModule({
      providers: [GazePredictionService],
    });
    service = TestBed.inject(GazePredictionService);
  });

  afterEach(() => {
    service.destroy();
    rafCallbacks = [];
    rafIds = 0;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('startTracking', () => {
    it('should store WebGazer reference and start tracking', async () => {
      await service.startTracking(mockWebgazer);
      expect(service.getFrameCount()).toBe(0);
    });

    it('should start manual polling', async () => {
      await service.startTracking(mockWebgazer);
      expect(window.requestAnimationFrame).toHaveBeenCalled();
    });

    it('should register custom gaze listener if set', async () => {
      const callback = jasmine.createSpy('callback');
      service.setGazeListener(callback);
      await service.startTracking(mockWebgazer);

      expect(mockSetGazeListener).toHaveBeenCalledWith(callback);
    });
  });

  describe('stopTracking', () => {
    it('should stop polling and clear WebGazer reference', async () => {
      await service.startTracking(mockWebgazer);
      service.stopTracking();

      expect(window.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('setGazeListener', () => {
    it('should store and register callback with WebGazer when tracking', async () => {
      const callback = jasmine.createSpy('callback');
      service.setGazeListener(callback);
      await service.startTracking(mockWebgazer);

      expect(mockSetGazeListener).toHaveBeenCalledWith(callback);
    });
  });

  describe('manual polling', () => {
    it('should emit predictions via observable', (done) => {
      let receivedCount = 0;
      
      service.predictionReceived$.subscribe({
        next: (p) => {
          receivedCount++;
          if (receivedCount >= 1) {
            expect(p.x).toBe(100);
            expect(p.y).toBe(200);
            done();
          }
        },
        error: done.fail,
      });
      
      service.startTracking(mockWebgazer).then(() => {
        rafCallbacks.forEach(cb => cb(1));
      });
    });
  });

  describe('getFrameCount', () => {
    it('should return current frame count', (done) => {
      service.startTracking(mockWebgazer).then(() => {
        rafCallbacks.forEach(cb => cb(1));
        setTimeout(() => {
          expect(service.getFrameCount()).toBeGreaterThan(0);
          done();
        }, 50);
      });
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      await service.startTracking(mockWebgazer);
      service.destroy();
      rafCallbacks.forEach(cb => cb(1));
      
      expect(service.getFrameCount()).toBe(0);
    });
  });
});
