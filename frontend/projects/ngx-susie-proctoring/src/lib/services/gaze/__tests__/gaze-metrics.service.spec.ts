import { TestBed } from '@angular/core/testing';
import { GazeMetricsService } from '../gaze-metrics.service';
import type { GazePoint } from '../gaze-smoothing.service';

describe('GazeMetricsService', () => {
  let service: GazeMetricsService;

  const createPoint = (x: number, y: number, ts: number = Date.now()): GazePoint => ({ x, y, ts });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazeMetricsService],
    });
    service = TestBed.inject(GazeMetricsService);
  });

  afterEach(() => {
    service.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('recordPoint', () => {
    it('should add point to buffer', () => {
      const point = createPoint(0.5, 0.3);
      service.recordPoint(point);
      expect(service.getBuffer().length).toBe(1);
    });

    it('should respect maxBufferSize limit', () => {
      service.setMaxBufferSize(3);
      service.recordPoint(createPoint(1, 1, 1000));
      service.recordPoint(createPoint(2, 2, 2000));
      service.recordPoint(createPoint(3, 3, 3000));
      service.recordPoint(createPoint(4, 4, 4000));

      const buffer = service.getBuffer();
      expect(buffer.length).toBe(3);
      expect(buffer[0].x).toBe(2);
      expect(buffer[2].x).toBe(4);
    });

    it('should remove oldest points when buffer is full', () => {
      service.setMaxBufferSize(2);
      service.recordPoint(createPoint(1, 1, 1000));
      service.recordPoint(createPoint(2, 2, 2000));
      service.recordPoint(createPoint(3, 3, 3000));

      const buffer = service.getBuffer();
      expect(buffer[0].x).toBe(2);
      expect(buffer[1].x).toBe(3);
    });
  });

  describe('flushBuffer', () => {
    it('should return all points and clear buffer', () => {
      service.recordPoint(createPoint(1, 1));
      service.recordPoint(createPoint(2, 2));

      const snapshot = service.flushBuffer();

      expect(snapshot.length).toBe(2);
      expect(snapshot[0].x).toBe(1);
      expect(service.getBuffer().length).toBe(0);
    });

    it('should return deep copy not reference', () => {
      service.recordPoint(createPoint(1, 1));
      const snapshot = service.flushBuffer();
      snapshot[0].x = 999;

      const buffer = service.getBuffer();
      expect(buffer.length).toBe(0);
    });
  });

  describe('getBuffer', () => {
    it('should return deep copy not reference', () => {
      service.recordPoint(createPoint(1, 1));
      const buffer1 = service.getBuffer();
      buffer1[0].x = 999;

      const buffer2 = service.getBuffer();
      expect(buffer2[0].x).toBe(1);
    });

    it('should return empty array when buffer is empty', () => {
      expect(service.getBuffer()).toEqual([]);
    });
  });

  describe('getMetrics', () => {
    it('should return zeros for empty buffer', () => {
      const metrics = service.getMetrics();
      expect(metrics.count).toBe(0);
      expect(metrics.minX).toBe(0);
      expect(metrics.maxX).toBe(0);
      expect(metrics.avgX).toBe(0);
    });

    it('should calculate min/max/avg correctly', () => {
      service.recordPoint(createPoint(1, 10));
      service.recordPoint(createPoint(2, 20));
      service.recordPoint(createPoint(3, 30));

      const metrics = service.getMetrics();
      expect(metrics.count).toBe(3);
      expect(metrics.minX).toBe(1);
      expect(metrics.maxX).toBe(3);
      expect(metrics.minY).toBe(10);
      expect(metrics.maxY).toBe(30);
      expect(metrics.avgX).toBe(2);
      expect(metrics.avgY).toBe(20);
    });
  });

  describe('clear', () => {
    it('should clear the buffer', () => {
      service.recordPoint(createPoint(1, 1));
      service.recordPoint(createPoint(2, 2));
      service.clear();

      expect(service.getBuffer().length).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clear the buffer', () => {
      service.recordPoint(createPoint(1, 1));
      service.destroy();

      expect(service.getBuffer().length).toBe(0);
    });
  });
});
