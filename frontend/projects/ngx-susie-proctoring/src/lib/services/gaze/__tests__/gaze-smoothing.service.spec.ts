import { TestBed } from '@angular/core/testing';
import { GazeSmoothingService, GazePoint } from '../gaze-smoothing.service';

describe('GazeSmoothingService', () => {
  let service: GazeSmoothingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazeSmoothingService],
    });
    service = TestBed.inject(GazeSmoothingService);
  });

  afterEach(() => {
    service.destroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('smoothAndNormalize', () => {
    beforeEach(() => {
      service.destroy();
    });

    it('should normalize center pixel (width/2, height/2) to (0, 0)', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1920);
      spyOnProperty(window, 'innerHeight').and.returnValue(1080);

      const result = service.smoothAndNormalize(960, 540);

      expect(result.x).toBeCloseTo(0, 2);
      expect(result.y).toBeCloseTo(0, 2);
    });

    it('should normalize top-left (0, 0) to (-1, -1)', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1920);
      spyOnProperty(window, 'innerHeight').and.returnValue(1080);

      const result = service.smoothAndNormalize(0, 0);

      expect(result.x).toBeCloseTo(-1, 2);
      expect(result.y).toBeCloseTo(-1, 2);
    });

    it('should normalize bottom-right (width, height) to (1, 1)', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1920);
      spyOnProperty(window, 'innerHeight').and.returnValue(1080);

      const result = service.smoothAndNormalize(1920, 1080);

      expect(result.x).toBeCloseTo(1, 2);
      expect(result.y).toBeCloseTo(1, 2);
    });

    it('should apply sliding window smoothing', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight').and.returnValue(1000);

      service.smoothAndNormalize(100, 100);
      service.smoothAndNormalize(200, 200);
      service.smoothAndNormalize(300, 300);

      const result = service.smoothAndNormalize(400, 400);

      expect(result.x).toBeGreaterThan(-1);
      expect(result.x).toBeLessThan(1);
    });

    it('should clip values outside [-1, 1] range', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(100);
      spyOnProperty(window, 'innerHeight').and.returnValue(100);

      const result = service.smoothAndNormalize(1000, 1000);

      expect(result.x).toBeLessThanOrEqual(1);
      expect(result.y).toBeLessThanOrEqual(1);
      expect(result.x).toBeGreaterThanOrEqual(-1);
      expect(result.y).toBeGreaterThanOrEqual(-1);
    });

    it('should return point with timestamp', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1920);
      spyOnProperty(window, 'innerHeight').and.returnValue(1080);

      const result = service.smoothAndNormalize(960, 540);

      expect(result.ts).toBeDefined();
      expect(typeof result.ts).toBe('number');
    });
  });

  describe('sliding window history', () => {
    beforeEach(() => {
      service.destroy();
    });

    it('should accumulate history on each call', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight').and.returnValue(1000);

      expect(service.getXHistory().length).toBe(0);

      service.smoothAndNormalize(100, 100);
      expect(service.getXHistory().length).toBe(1);

      service.smoothAndNormalize(200, 200);
      expect(service.getXHistory().length).toBe(2);
    });

    it('should respect smoothingWindow limit', () => {
      service.setSmoothingWindow(3);
      spyOnProperty(window, 'innerWidth').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight').and.returnValue(1000);

      service.smoothAndNormalize(100, 100);
      service.smoothAndNormalize(200, 200);
      service.smoothAndNormalize(300, 300);
      service.smoothAndNormalize(400, 400);

      expect(service.getXHistory().length).toBe(3);
    });

    it('should calculate correct average with window', () => {
      service.setSmoothingWindow(3);
      spyOnProperty(window, 'innerWidth').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight').and.returnValue(1000);

      service.smoothAndNormalize(100, 100);
      service.smoothAndNormalize(200, 200);
      service.smoothAndNormalize(300, 300);

      const history = service.getXHistory();
      const avg = history.reduce((a, b) => a + b, 0) / history.length;

      expect(avg).toBeCloseTo(-0.6, 1);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      service.destroy();
    });

    it('should clear history arrays', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight').and.returnValue(1000);

      service.smoothAndNormalize(100, 100);
      service.smoothAndNormalize(200, 200);

      expect(service.getXHistory().length).toBe(2);

      service.reset();

      expect(service.getXHistory().length).toBe(0);
      expect(service.getYHistory().length).toBe(0);
    });

    it('should start fresh smoothing after reset', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight').and.returnValue(1000);

      service.smoothAndNormalize(100, 100);
      service.smoothAndNormalize(200, 200);
      service.reset();

      const result = service.smoothAndNormalize(500, 500);

      expect(result.x).toBeCloseTo(0, 1);
    });
  });

  describe('setSmoothingWindow', () => {
    it('should set new window size', () => {
      service.setSmoothingWindow(5);
      spyOnProperty(window, 'innerWidth').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight').and.returnValue(1000);

      for (let i = 0; i < 10; i++) {
        service.smoothAndNormalize(i * 100, i * 100);
      }

      expect(service.getXHistory().length).toBe(5);
    });

    it('should trim history when window is reduced', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight').and.returnValue(1000);

      service.smoothAndNormalize(100, 100);
      service.smoothAndNormalize(200, 200);
      service.smoothAndNormalize(300, 300);

      expect(service.getXHistory().length).toBe(3);

      service.setSmoothingWindow(2);

      expect(service.getXHistory().length).toBe(2);
    });
  });

  describe('destroy', () => {
    it('should clear history arrays', () => {
      spyOnProperty(window, 'innerWidth').and.returnValue(1000);
      spyOnProperty(window, 'innerHeight').and.returnValue(1000);

      service.smoothAndNormalize(100, 100);
      service.destroy();

      expect(service.getXHistory().length).toBe(0);
    });
  });
});
