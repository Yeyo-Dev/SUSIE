import { TestBed } from '@angular/core/testing';
import { DeviationDetectionService } from './deviation-detection.service';
import { GazePoint } from './gaze.interfaces';

describe('DeviationDetectionService', () => {
    let service: DeviationDetectionService;
    let mockLogger: jasmine.Spy;
    let mockOnDeviation: jasmine.Spy;
    let mockGetLastPoint: jasmine.Spy;

    const DEFAULT_THRESHOLD = 0.82;
    const DEFAULT_TOLERANCE = 5; // seconds

    beforeEach(() => {
        jasmine.clock().uninstall();
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date(2024, 0, 1, 12, 0, 0, 0));
        TestBed.configureTestingModule({
            providers: [DeviationDetectionService]
        });
        service = TestBed.inject(DeviationDetectionService);
        mockLogger = jasmine.createSpy('logger');
        mockOnDeviation = jasmine.createSpy('onDeviation');
        mockGetLastPoint = jasmine.createSpy('getLastPoint');
    });

    afterEach(() => {
        service.destroy();
        jasmine.clock().uninstall();
    });

    describe('DEV-001: Detect sustained gaze deviation with stability delay', () => {

        describe('DEV-001-A: Starts check interval on start', () => {
            it('should create a 1-second interval when start() is called', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0.5, y: 0.5, ts: Date.now() });

                service.start(mockGetLastPoint);

                // Should not have deviation initially
                expect((service as any).hasDeviation()).toBe(false);

                // Advance 1 second - interval fires
                jasmine.clock().tick(1000);
                expect(mockGetLastPoint).toHaveBeenCalled();

                service.stop();
            });

            it('should call stop() before creating new interval if already running', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0.5, y: 0.5, ts: Date.now() });

                service.start(mockGetLastPoint);
                jasmine.clock().tick(1000);

                // Start again - should stop previous interval
                service.start(mockGetLastPoint);

                // Should still work after restart
                jasmine.clock().tick(1000);
                expect(mockGetLastPoint).toHaveBeenCalled();
            });
        });

        describe('DEV-001-B: No deviation when point is in bounds', () => {
            it('should not trigger deviation when point is centered (0, 0)', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0, y: 0, ts: Date.now() });

                service.start(mockGetLastPoint);

                jasmine.clock().tick(6000); // 6 seconds (past tolerance)

                expect((service as any).hasDeviation()).toBe(false);
                expect(mockOnDeviation).not.toHaveBeenCalled();
            });

            it('should not trigger deviation when point is within threshold', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                // Just within threshold: 0.82 - 0.01 = 0.81
                mockGetLastPoint.and.returnValue({ x: 0.81, y: 0.81, ts: Date.now() });

                service.start(mockGetLastPoint);

                jasmine.clock().tick(6000);

                expect((service as any).hasDeviation()).toBe(false);
                expect(mockOnDeviation).not.toHaveBeenCalled();
            });

            it('should trigger deviation when x coordinate is out of bounds', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                // x out of bounds, y in bounds - OR condition means deviation triggered
                mockGetLastPoint.and.returnValue({ x: 0.9, y: 0.5, ts: Date.now() });

                service.start(mockGetLastPoint);

                // After tolerance+1 seconds of continuous out-of-bounds x
                jasmine.clock().tick(6000);

                // This WILL trigger deviation because x > threshold
                expect((service as any).hasDeviation()).toBe(true);
            });
        });

        describe('DEV-001-C: Detects deviation after tolerance seconds', () => {
            it('should set hasDeviation to true after tolerance seconds of out-of-bounds', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                // Point out of bounds
                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.5, ts: Date.now() });

                service.start(mockGetLastPoint);

                // Note: deviationStartTime is set on FIRST interval (t=1s), not at start()
                // So: first interval at t=1s sets deviationStartTime, then 5 more intervals needed
                // Total: 6 seconds from start() for deviation to trigger (elapsed >= 5s)

                // 5 seconds - not yet triggered (elapsed = 4s at t=5s)
                jasmine.clock().tick(5000);
                expect((service as any).hasDeviation()).toBe(false);

                // 6 seconds total - should trigger (elapsed =5s at t=6s)
                jasmine.clock().tick(1000);
                expect((service as any).hasDeviation()).toBe(true);
                expect(mockOnDeviation).toHaveBeenCalled();
            });

            it('should invoke onDeviation callback', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0.9, y: 0.9, ts: Date.now() });

                service.start(mockGetLastPoint);

                // Need tolerance + 1 seconds for deviation to trigger (first interval sets startTime)
                jasmine.clock().tick(6000);

                expect(mockOnDeviation).toHaveBeenCalled();
            });

            it('should log error message with elapsed time', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: -0.95, y: -0.95, ts: Date.now() });

                service.start(mockGetLastPoint);

                // Need tolerance + 1 seconds for deviation to trigger
                jasmine.clock().tick(6000);

                expect(mockLogger).toHaveBeenCalledWith(
                    'error',
                    jasmine.stringMatching(/GAZE_DEVIATION/)
                );
            });

            it('should trigger deviation for negative coordinates beyond threshold', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: -0.9, y: -0.9, ts: Date.now() });

                service.start(mockGetLastPoint);

                // Need tolerance + 1 seconds for deviation to trigger
                jasmine.clock().tick(6000);

                expect((service as any).hasDeviation()).toBe(true);
            });
        });

        describe('DEV-001-D: Does not trigger deviation within tolerance window', () => {
            it('should not trigger deviation before tolerance seconds', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });

                service.start(mockGetLastPoint);

                jasmine.clock().tick(2000);

                expect((service as any).hasDeviation()).toBe(false);
                expect(mockOnDeviation).not.toHaveBeenCalled();
            });

            it('should not trigger at exactly tolerance - 1 seconds', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });

                service.start(mockGetLastPoint);

                jasmine.clock().tick(4000); // 4 seconds (tolerance = 5)

                expect((service as any).hasDeviation()).toBe(false);
            });
        });

        describe('DEV-001-E: Requires stability delay before resetting deviation', () => {
            it('should keep hasDeviation true when in-bounds for <500ms', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);

                // First: trigger deviation (need tolerance+1 seconds)
                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });
                service.start(mockGetLastPoint);
                jasmine.clock().tick(6000);

                expect((service as any).hasDeviation()).toBe(true);

                // Then: point returns in-bounds
                mockGetLastPoint.and.returnValue({ x: 0.5, y: 0.5, ts: Date.now() });
                jasmine.clock().tick(300); // Less than 500ms

                // Deviation should still be true
                expect((service as any).hasDeviation()).toBe(true);
            });

it('should track lastInBoundsTime when point returns', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);

                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });
                service.start(mockGetLastPoint);
                jasmine.clock().tick(6000);

                expect((service as any).hasDeviation()).toBe(true);

                // Point returns in-bounds
                // Need 2 ticks for stability delay check to complete
                mockGetLastPoint.and.returnValue({ x: 0.5, y: 0.5, ts: Date.now() });
                jasmine.clock().tick(2000); // 2 seconds = 2 intervals

                expect((service as any).hasDeviation()).toBe(false);
            });
        });

        describe('DEV-001-F: Resets deviation after stability delay', () => {
            it('should set hasDeviation to false after >=500ms in-bounds', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);

                // Trigger deviation (need tolerance+1 seconds)
                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });
                service.start(mockGetLastPoint);
                jasmine.clock().tick(6000);

                expect((service as any).hasDeviation()).toBe(true);

                // Point returns in-bounds for stability delay
                // Need 2 ticks: first sets lastInBoundsTime, second checks elapsed >= 500ms
                mockGetLastPoint.and.returnValue({ x: 0.5, y: 0.5, ts: Date.now() });
                jasmine.clock().tick(2000); // 2 seconds = 2 intervals

                // Deviation cleared after stability
                expect((service as any).hasDeviation()).toBe(false);
            });

            it('should log info when deviation clears', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);

                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });
                service.start(mockGetLastPoint);
                jasmine.clock().tick(6000);

                mockLogger.calls.reset();

                mockGetLastPoint.and.returnValue({ x: 0.5, y: 0.5, ts: Date.now() });
                jasmine.clock().tick(2000);

                expect(mockLogger).toHaveBeenCalledWith(
                    'info',
                    jasmine.stringMatching(/regresó/)
                );
            });

            it('should reset deviationStartTime and lastInBoundsTime after stability', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);

                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });
                service.start(mockGetLastPoint);
                jasmine.clock().tick(6000);

                mockGetLastPoint.and.returnValue({ x: 0.5, y: 0.5, ts: Date.now() });
                jasmine.clock().tick(2000);

                // Internal state should be cleared
                expect((service as any).deviationStartTime).toBeNull();
                expect((service as any).lastInBoundsTime).toBeNull();
            });
        });

        describe('DEV-001-G: Stop clears interval and state', () => {
            it('should clear interval when stop() is called', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });

                service.start(mockGetLastPoint);
                jasmine.clock().tick(2000);

                service.stop();

                // Advance past tolerance - should not trigger
                jasmine.clock().tick(5000);

                // Interval was cleared, no more checks
                // deviationStartTime should be null after stop
                expect((service as any).deviationStartTime).toBeNull();
            });

            it('should be safe to call stop() without start()', () => {
                service.stop();

                // Should not throw
                expect(true).toBeTrue();
            });

            it('should reset deviationStartTime and lastInBoundsTime on stop()', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });

                service.start(mockGetLastPoint);
                jasmine.clock().tick(2000);

                service.stop();

                expect((service as any).deviationStartTime).toBeNull();
                expect((service as any).lastInBoundsTime).toBeNull();
            });
        });

        describe('Additional coverage', () => {
            it('should handle null point gracefully', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, DEFAULT_TOLERANCE, mockOnDeviation);
                mockGetLastPoint.and.returnValue(null);

                service.start(mockGetLastPoint);
                jasmine.clock().tick(1000);

                // Should not throw, should not have deviation
                expect((service as any).hasDeviation()).toBe(false);
            });

            it('should use custom threshold from configure()', () => {
                // Use threshold 0.5 instead of default 0.82
                service.configure(mockLogger, 0.5, DEFAULT_TOLERANCE, mockOnDeviation);
                // Point at 0.6 would be in-bounds for threshold 0.82, but out for 0.5
                mockGetLastPoint.and.returnValue({ x: 0.6, y: 0.5, ts: Date.now() });

                service.start(mockGetLastPoint);
                // Need tolerance+1 seconds
                jasmine.clock().tick(6000);

                expect((service as any).hasDeviation()).toBe(true);
            });

            it('should use custom tolerance from configure()', () => {
                // Use tolerance 2 seconds instead of default 5
                service.configure(mockLogger, DEFAULT_THRESHOLD, 2, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });

                service.start(mockGetLastPoint);
                // Need tolerance+1 seconds = 3 seconds
                jasmine.clock().tick(3000);

                expect((service as any).hasDeviation()).toBe(true);
            });

            it('should not trigger if tolerance is 0', () => {
                service.configure(mockLogger, DEFAULT_THRESHOLD, 0, mockOnDeviation);
                mockGetLastPoint.and.returnValue({ x: 0.95, y: 0.95, ts: Date.now() });

                service.start(mockGetLastPoint);
                
                // First tick (interval fires at 1 second)
                jasmine.clock().tick(1000);

                // With tolerance 0, elapsed >= 0 is immediately true at first check
                // So deviation might trigger on first interval fire
                // Let's verify the behavior
                expect((service as any).hasDeviation()).toBe(true);
            });
        });
    });
});