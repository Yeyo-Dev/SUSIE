import { TestBed } from '@angular/core/testing';
import { CalibrationService } from './calibration.service';

describe('CalibrationService', () => {
    let service: CalibrationService;
    let mockLogger: jasmine.Spy;
    let mockWebgazerRef: { resume: jasmine.Spy };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [CalibrationService]
        });
        service = TestBed.inject(CalibrationService);
        mockLogger = jasmine.createSpy('logger');
        mockWebgazerRef = { resume: jasmine.createSpy('resume') };
        service.configure(mockLogger, mockWebgazerRef);
    });

    describe('CAL-001: Track calibration state and metrics', () => {

        describe('CAL-001-A: Resets metrics on start', () => {
            it('should reset all metrics when start() is called', () => {
                // First, record some data
                service.start();
                service.recordClick(100, 200);
                service.recordClick(150, 250);
                service.recordCalibrationFrame();
                service.recordConfidence(0.8);

                // Start again - should reset
                service.start();

                const metrics = service.getMetrics();
                expect(metrics.calibrationClicks).toBe(0);
                expect(metrics.calibrationFrames).toBe(0);
                expect(metrics.avgConfidence).toBeNull(); // Reset means no confidence data
            });

            it('should set calibrationStartTime on start()', () => {
                jasmine.clock().uninstall();
                jasmine.clock().install();
                const startTime = Date.now();
                jasmine.clock().mockDate(new Date(startTime));

                service.start();

                const metrics = service.getMetrics();
                expect(metrics.calibrationStartTime).toBe(startTime);

                jasmine.clock().uninstall();
            });
        });

        describe('CAL-001-B: Records calibration clicks with progress emoji', () => {
            it('should record clicks and use hourglass emoji for clicks <5', () => {
                service.start();

                service.recordClick(100, 200);
                service.recordClick(150, 250);
                service.recordClick(200, 300);
                service.recordClick(250, 350);
                service.recordClick(300, 400);
                // 5 clicks

                expect(mockLogger).toHaveBeenCalledWith(
                    'success',
                    jasmine.stringMatching(/⏳ Click #[1-5] registrado/)
                );
                expect(mockLogger).toHaveBeenCalledWith(
                    'success',
                    jasmine.stringMatching(/🔄 Click #5 registrado/)
                );

                const metrics = service.getMetrics();
                expect(metrics.calibrationClicks).toBe(5);
            });

            it('should use refresh emoji for clicks 5-8', () => {
                service.start();

                for (let i = 1; i <= 8; i++) {
                    service.recordClick(i * 100, i * 100);
                }

                // Clicks 5-8 should have 🔄 emoji
                expect(mockLogger).toHaveBeenCalledWith(
                    'success',
                    jasmine.stringMatching(/🔄 Click #[5-8] registrado/)
                );

                const metrics = service.getMetrics();
                expect(metrics.calibrationClicks).toBe(8);
            });

            it('should use checkmark emoji for clicks >=9', () => {
                service.start();

                for (let i = 1; i <= 10; i++) {
                    service.recordClick(i * 100, i * 100);
                }

                // Clicks >= 9 should have ✅ emoji
                expect(mockLogger).toHaveBeenCalledWith(
                    'success',
                    jasmine.stringMatching(/✅ Click #9 registrado/)
                );
                expect(mockLogger).toHaveBeenCalledWith(
                    'success',
                    jasmine.stringMatching(/✅ Click #10 registrado/)
                );

                const metrics = service.getMetrics();
                expect(metrics.calibrationClicks).toBe(10);
            });
        });

        describe('CAL-001-C: Calculates average confidence', () => {
            it('should calculate average from recorded confidence values', () => {
                service.start();
                service.recordConfidence(0.8);
                service.recordConfidence(0.9);
                service.recordConfidence(0.7);

                const metrics = service.getMetrics();
                expect(metrics.avgConfidence).toBeCloseTo(0.8, 2);
            });

            it('should return null avgConfidence when no confidence recorded', () => {
                service.start();

                const metrics = service.getMetrics();
                expect(metrics.avgConfidence).toBeNull();
            });

            it('should handle single confidence value', () => {
                service.start();
                service.recordConfidence(0.95);

                const metrics = service.getMetrics();
                expect(metrics.avgConfidence).toBeCloseTo(0.95, 2);
            });

            it('should update average correctly with multiple values', () => {
                service.start();
                service.recordConfidence(1.0);
                service.recordConfidence(0.5);

                const metrics = service.getMetrics();
                expect(metrics.avgConfidence).toBeCloseTo(0.75, 2);
            });
        });

        describe('CAL-001-D: Complete resumes webgazer and returns metrics', () => {
            it('should call webgazerRef.resume() on complete', () => {
                service.start();
                service.recordClick(100, 200);
                service.recordCalibrationFrame();

                const mockGetState = jasmine.createSpy('getState').and.returnValue('CALIBRATING');
                service.complete(mockGetState);

                expect(mockWebgazerRef.resume).toHaveBeenCalled();
            });

            it('should return complete GazeCalibrationMetrics object', () => {
                service.start();
                service.recordClick(100, 200);
                service.recordClick(150, 250);
                service.recordCalibrationFrame();
                service.recordCalibrationFrame();
                service.recordConfidence(0.85);

                const mockGetState = jasmine.createSpy('getState').and.returnValue('TRACKING');
                const metrics = service.complete(mockGetState);

                expect(metrics.calibrationClicks).toBe(2);
                expect(metrics.calibrationFrames).toBe(2);
                expect(metrics.avgConfidence).toBeCloseTo(0.85, 2);
                expect(metrics.faceDetected).toBe(true);
                expect(metrics.calibrationCompleteTime).toBeDefined();
            });

            it('should set calibrationCompleteTime on complete', () => {
                jasmine.clock().uninstall();
                jasmine.clock().install();
                jasmine.clock().mockDate(new Date(10000));

                service.start();
                service.recordClick(100, 200);

                const completeTime = Date.now();
                const mockGetState = jasmine.createSpy('getState').and.returnValue('TRACKING');
                const metrics = service.complete(mockGetState);

                expect(metrics.calibrationCompleteTime).toBe(completeTime);

                jasmine.clock().uninstall();
            });

            it('should handle webgazerRef.resume not being a function gracefully', () => {
                const invalidWebgazer = { resume: 'not a function' } as any;
                service.configure(mockLogger, invalidWebgazer);

                service.start();
                service.recordClick(100, 200);

                const mockGetState = jasmine.createSpy('getState').and.returnValue('CALIBRATING');

                // Should not throw
                expect(() => service.complete(mockGetState)).not.toThrow();
            });

            it('should handle webgazerRef being null gracefully', () => {
                service.configure(mockLogger, null);
                service.start();
                service.recordClick(100, 200);

                const mockGetState = jasmine.createSpy('getState').and.returnValue('CALIBRATING');

                // Should not throw
                expect(() => service.complete(mockGetState)).not.toThrow();
            });
        });

        describe('Additional coverage', () => {
            it('should track calibration frames', () => {
                service.start();
                service.recordCalibrationFrame();
                service.recordCalibrationFrame();
                service.recordCalibrationFrame();

                const metrics = service.getMetrics();
                expect(metrics.calibrationFrames).toBe(3);
            });

            it('should track tracking frames', () => {
                service.start();
                service.recordTrackingFrame();
                service.recordTrackingFrame();

                const metrics = service.getMetrics();
                expect(metrics.trackingFrames).toBe(2);
            });

            it('should set faceDetected based on calibration frames', () => {
                service.start();

                let metrics = service.getMetrics();
                expect(metrics.faceDetected).toBe(false);

                service.recordCalibrationFrame();
                metrics = service.getMetrics();
                expect(metrics.faceDetected).toBe(true);
            });
        });
    });
});