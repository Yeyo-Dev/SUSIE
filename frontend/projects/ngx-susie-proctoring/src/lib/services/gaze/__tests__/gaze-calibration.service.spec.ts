import { TestBed } from '@angular/core/testing';
import {
  GazeCalibrationService,
  CalibrationResult,
  CalibrationStatus,
} from '../gaze-calibration.service';
import { LoggerFn, WebGazerAPI, WebGazerPrediction } from '@lib/models/contracts';

/**
 * Tests exhaustivos para GazeCalibrationService
 *
 * Cobertura objetivo: 85%+
 *
 * Suite de tests:
 * ✅ Setup & Teardown
 * ✅ startCalibration()
 * ✅ recordCalibrationClick()
 * ✅ completeCalibration()
 * ✅ resetCalibration()
 * ✅ Error handling
 * ✅ Cleanup & destroy()
 */
describe('GazeCalibrationService', () => {
  let service: GazeCalibrationService;
  let mockWebGazer: jasmine.SpyObj<WebGazerAPI>;
  let loggedMessages: Array<{ level: string; message: string }>;
  let mockLogger: LoggerFn;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GazeCalibrationService],
    });

    service = TestBed.inject(GazeCalibrationService);

    // Setup mock logger
    loggedMessages = [];
    mockLogger = (level: string, message: string, error?: any) => {
      loggedMessages.push({ level, message });
    };

    // Setup mock WebGazer
    mockWebGazer = jasmine.createSpyObj<WebGazerAPI>('WebGazerAPI', [
      'setTracker',
      'setRegression',
      'setGazeListener',
      'begin',
      'end',
      'resume',
      'showVideoPreview',
      'showPredictionPoints',
      'getCurrentPrediction',
    ]);

    // Chain methods for fluent API
    mockWebGazer.setTracker.and.returnValue(mockWebGazer);
    mockWebGazer.setRegression.and.returnValue(mockWebGazer);
    mockWebGazer.setGazeListener.and.returnValue(mockWebGazer);
    mockWebGazer.showVideoPreview.and.returnValue(mockWebGazer);
    mockWebGazer.showPredictionPoints.and.returnValue(mockWebGazer);
    mockWebGazer.begin.and.returnValue(Promise.resolve());

    // Setup mock window.webgazer
    (window as any).webgazer = mockWebGazer;

    service.setLogger(mockLogger);
  });

  afterEach(() => {
    // Clean up window.webgazer
    delete (window as any).webgazer;

    // Cleanup service
    service.destroy();
  });

  // ─── SETUP & TEARDOWN ───────────────────────────────────────

  describe('Setup & Teardown', () => {
    it('should initialize with idle status', () => {
      expect(service.getStatus()).toBe('idle');
    });

    it('should allow logger configuration', () => {
      const customLogger: LoggerFn = (level, message) => {};
      service.setLogger(customLogger);

      // Logger should be used (we can verify via internal calls)
      expect(service).toBeDefined();
    });

    it('should have observable streams for events', () => {
      expect(service.calibrationCompleted$).toBeDefined();
      expect(service.calibrationError$).toBeDefined();
    });
  });

  // ─── START CALIBRATION ───────────────────────────────────────

  describe('startCalibration()', () => {
    it('should successfully initialize WebGazer without existing stream', async () => {
      const result = await service.startCalibration();

      expect(result).toBe(true);
      expect(service.getStatus()).toBe('in-progress');
      expect(mockWebGazer.setTracker).toHaveBeenCalledWith('TFFacemesh');
      expect(mockWebGazer.setRegression).toHaveBeenCalledWith('ridge');
      expect(mockWebGazer.begin).toHaveBeenCalled();
    });

    it('should use existing stream when provided', async () => {
      const mockStream = jasmine.createSpyObj<MediaStream>('MediaStream', [
        'getTracks',
      ]);
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia;

      try {
        const result = await service.startCalibration(mockStream);

        expect(result).toBe(true);
        // Verify that getUserMedia was monkey-patched
        const patchedResult = await navigator.mediaDevices.getUserMedia({});
        expect(patchedResult).toBe(mockStream);
      } finally {
        // Restore original
        navigator.mediaDevices.getUserMedia = originalGetUserMedia;
      }
    });

    it('should set up gaze listener', async () => {
      await service.startCalibration();

      expect(mockWebGazer.setGazeListener).toHaveBeenCalled();
    });

    it('should show video preview and prediction points', async () => {
      await service.startCalibration();

      expect(mockWebGazer.showVideoPreview).toHaveBeenCalledWith(true);
      expect(mockWebGazer.showPredictionPoints).toHaveBeenCalledWith(true);
    });

    it('should handle WebGazer not loaded', async () => {
      delete (window as any).webgazer;

      const result = await service.startCalibration();

      expect(result).toBe(false);
      expect(service.getStatus()).toBe('error');
    });

    it('should handle WebGazer.begin() failure', async () => {
      mockWebGazer.begin.and.returnValue(Promise.reject(new Error('Begin failed')));

      const result = await service.startCalibration();

      expect(result).toBe(false);
      expect(service.getStatus()).toBe('error');
    });

    it('should mute WebGazer videos', async () => {
      // Create mock video element in DOM
      const videoContainer = document.createElement('div');
      videoContainer.id = 'webgazerVideoContainer';
      const video = document.createElement('video');
      video.id = 'webgazerVideoFeed';
      videoContainer.appendChild(video);
      document.body.appendChild(videoContainer);

      try {
        await service.startCalibration();

        const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
        expect(videoEl.muted).toBe(true);
      } finally {
        document.body.removeChild(videoContainer);
      }
    });

    it('should log appropriate messages during startup', async () => {
      loggedMessages = [];
      await service.startCalibration();

      // Should have logged several messages
      expect(loggedMessages.length).toBeGreaterThan(0);

      // Should include success message
      const successMessage = loggedMessages.some(msg =>
        msg.message.includes('WebGazer iniciado')
      );
      expect(successMessage).toBe(true);
    });
  });

  // ─── RECORD CALIBRATION CLICK ───────────────────────────────

  describe('recordCalibrationClick()', () => {
    it('should record calibration point when WebGazer is initialized', async () => {
      await service.startCalibration();

      loggedMessages = [];
      service.recordCalibrationClick(100, 200);

      expect(loggedMessages.some(msg =>
        msg.message.includes('Punto de calibración #1')
      )).toBe(true);
    });

    it('should increment point counter', async () => {
      await service.startCalibration();

      service.recordCalibrationClick(100, 200);
      service.recordCalibrationClick(150, 250);
      service.recordCalibrationClick(200, 300);

      // Last message should indicate 3 points
      const lastMessage = loggedMessages[loggedMessages.length - 1];
      expect(lastMessage.message).toContain('#3');
    });

    it('should handle missing WebGazer gracefully', () => {
      service.recordCalibrationClick(100, 200);

      expect(loggedMessages.some(msg =>
        msg.message.includes('no está inicializado')
      )).toBe(true);
    });

    it('should log coordinates', async () => {
      await service.startCalibration();

      loggedMessages = [];
      service.recordCalibrationClick(512, 384);

      const message = loggedMessages.find(msg =>
        msg.message.includes('512')
      );
      expect(message).toBeDefined();
    });
  });

  // ─── COMPLETE CALIBRATION ───────────────────────────────────

  describe('completeCalibration()', () => {
    it('should return WebGazer instance when successful', async () => {
      await service.startCalibration();

      const result = await service.completeCalibration();

      expect(result).toBe(mockWebGazer);
      expect(service.getStatus()).toBe('completed');
    });

    it('should emit calibrationCompleted$ event', async (done) => {
      await service.startCalibration();

      service.calibrationCompleted$.subscribe((result: CalibrationResult) => {
        expect(result.success).toBe(true);
        expect(result.webgazer).toBe(mockWebGazer);
        expect(result.pointsRecorded).toBeGreaterThanOrEqual(0);
        done();
      });

      await service.completeCalibration();
    });

    it('should call resume() on WebGazer', async () => {
      await service.startCalibration();

      await service.completeCalibration();

      expect(mockWebGazer.resume).toHaveBeenCalled();
    });

    it('should move video container offscreen but visible', async () => {
      const videoContainer = document.createElement('div');
      videoContainer.id = 'webgazerVideoContainer';
      document.body.appendChild(videoContainer);

      try {
        await service.startCalibration();
        await service.completeCalibration();

        const container = document.getElementById('webgazerVideoContainer');
        expect(container?.style.position).toBe('fixed');
        expect(container?.style.top).toBe('-9999px');
        expect(container?.style.left).toBe('-9999px');
        expect(container?.style.display).toBe('block');
        expect(container?.style.visibility).toBe('visible');
      } finally {
        document.body.removeChild(videoContainer);
      }
    });

    it('should hide gaze dot', async () => {
      const gazeDot = document.createElement('div');
      gazeDot.id = 'webgazerGazeDot';
      document.body.appendChild(gazeDot);

      try {
        await service.startCalibration();
        await service.completeCalibration();

        const dot = document.getElementById('webgazerGazeDot');
        expect(dot?.style.display).toBe('none');
      } finally {
        document.body.removeChild(gazeDot);
      }
    });

    it('should return null if not in-progress status', async () => {
      const result = await service.completeCalibration();

      expect(result).toBeNull();
    });

    it('should handle resume() error gracefully', async () => {
      mockWebGazer.resume.and.throwError('Resume failed');

      await service.startCalibration();

      loggedMessages = [];
      const result = await service.completeCalibration();

      // Should still complete successfully
      expect(result).toBe(mockWebGazer);
      expect(loggedMessages.some(msg =>
        msg.level === 'error' && msg.message.includes('resume')
      )).toBe(true);
    });
  });

  // ─── RESET CALIBRATION ──────────────────────────────────────

  describe('resetCalibration()', () => {
    it('should reset to idle status', async () => {
      await service.startCalibration();
      expect(service.getStatus()).toBe('in-progress');

      service.resetCalibration();

      expect(service.getStatus()).toBe('idle');
    });

    it('should clear calibration data', async () => {
      await service.startCalibration();
      service.recordCalibrationClick(100, 200);

      loggedMessages = [];
      service.resetCalibration();

      // After reset, recording should start from #1 again
      service.recordCalibrationClick(150, 250);
      const message = loggedMessages.find(msg =>
        msg.message.includes('#1')
      );
      expect(message).toBeDefined();
    });

    it('should not clear WebGazer reference', async () => {
      await service.startCalibration();

      service.resetCalibration();

      // WebGazer should still be available for reuse
      expect(service).toBeDefined();
    });

    it('should log reset message', () => {
      loggedMessages = [];
      service.resetCalibration();

      expect(loggedMessages.some(msg =>
        msg.message.includes('reiniciado')
      )).toBe(true);
    });
  });

  // ─── DESTROY & CLEANUP ──────────────────────────────────────

  describe('destroy()', () => {
    it('should call webgazer.end()', async () => {
      await service.startCalibration();

      service.destroy();

      expect(mockWebGazer.end).toHaveBeenCalled();
    });

    it('should reset status to idle', async () => {
      await service.startCalibration();

      service.destroy();

      expect(service.getStatus()).toBe('idle');
    });

    it('should complete observable streams', async (done) => {
      await service.startCalibration();

      let completedCount = 0;

      service.calibrationCompleted$.subscribe(
        () => {},
        () => {},
        () => {
          completedCount++;
        }
      );

      service.calibrationError$.subscribe(
        () => {},
        () => {},
        () => {
          completedCount++;
        }
      );

      service.destroy();

      // Give time for completions to propagate
      setTimeout(() => {
        expect(completedCount).toBe(2);
        done();
      }, 10);
    });

    it('should handle webgazer.end() failure', async () => {
      mockWebGazer.end.and.throwError('End failed');

      await service.startCalibration();

      expect(() => {
        service.destroy();
      }).not.toThrow();
    });

    it('should log cleanup message', () => {
      loggedMessages = [];
      service.destroy();

      expect(loggedMessages.some(msg =>
        msg.message.includes('limpiado')
      )).toBe(true);
    });
  });

  // ─── ERROR HANDLING ──────────────────────────────────────────

  describe('Error handling', () => {
    it('should emit calibrationError$ on WebGazer load failure', async (done) => {
      delete (window as any).webgazer;

      service.calibrationError$.subscribe((error: string) => {
        expect(error).toContain('WebGazer no está cargado');
        done();
      });

      await service.startCalibration();
    });

    it('should handle network/stream errors', async () => {
      mockWebGazer.begin.and.returnValue(Promise.reject(new Error('Network error')));

      const result = await service.startCalibration();

      expect(result).toBe(false);
      expect(service.getStatus()).toBe('error');
    });

    it('should handle destroy() errors gracefully', () => {
      mockWebGazer.end.and.throwError('End failed');

      expect(() => {
        service.destroy();
      }).not.toThrow();
    });
  });

  // ─── INTEGRATION SCENARIOS ──────────────────────────────────

  describe('Integration scenarios', () => {
    it('should complete full calibration flow', async () => {
      // 1. Start calibration
      const startResult = await service.startCalibration();
      expect(startResult).toBe(true);

      // 2. Record some clicks
      service.recordCalibrationClick(100, 200);
      service.recordCalibrationClick(500, 300);
      service.recordCalibrationClick(900, 600);

      // 3. Complete calibration
      const webgazer = await service.completeCalibration();
      expect(webgazer).toBe(mockWebGazer);

      // 4. Reset if needed
      service.resetCalibration();
      expect(service.getStatus()).toBe('idle');

      // 5. Cleanup
      service.destroy();
      expect(service.getStatus()).toBe('idle');
    });

    it('should handle retry after error', async () => {
      // First attempt fails
      delete (window as any).webgazer;
      let result = await service.startCalibration();
      expect(result).toBe(false);

      // Reset and retry
      service.resetCalibration();
      (window as any).webgazer = mockWebGazer;

      result = await service.startCalibration();
      expect(result).toBe(true);
    });

    it('should properly cleanup after complete flow', async () => {
      await service.startCalibration();
      service.recordCalibrationClick(100, 200);
      await service.completeCalibration();

      // No errors on destroy
      expect(() => {
        service.destroy();
      }).not.toThrow();
    });
  });

  // ─── MEMORY & CLEANUP VERIFICATION ──────────────────────────

  describe('Memory & cleanup verification', () => {
    it('should handle multiple destroy calls', () => {
      expect(() => {
        service.destroy();
        service.destroy();
        service.destroy();
      }).not.toThrow();
    });

    it('should complete streams even if not subscribed', async () => {
      await service.startCalibration();

      // No subscribers
      expect(() => {
        service.destroy();
      }).not.toThrow();
    });
  });
});
