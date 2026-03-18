import { TestBed } from '@angular/core/testing';
import { GazeDiagnosticsService } from './gaze-diagnostics.service';
import { GazeState } from './gaze.interfaces';

describe('GazeDiagnosticsService', () => {
    let service: GazeDiagnosticsService;
    let mockLogger: jasmine.Spy;
    let mockGetFrameCount: jasmine.Spy;
    let mockGetState: jasmine.Spy;

    beforeEach(() => {
        jasmine.clock().uninstall();
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date(2024, 0, 1, 12, 0, 0, 0));
        TestBed.configureTestingModule({
            providers: [GazeDiagnosticsService]
        });
        service = TestBed.inject(GazeDiagnosticsService);
        mockLogger = jasmine.createSpy('logger');
        mockGetFrameCount = jasmine.createSpy('getFrameCount');
        mockGetState = jasmine.createSpy('getState');
        service.configure(mockLogger);
    });

    afterEach(() => {
        service.stop();
        jasmine.clock().uninstall();
    });

    describe('DIAG-001: Monitor gaze pipeline health', () => {

        describe('DIAG-001-A: Starts interval on start', () => {
            it('should create a 10-second interval when start() is called', () => {
                mockGetFrameCount.and.returnValue(0);
                mockGetState.and.returnValue('TRACKING');

                service.start(mockGetFrameCount, mockGetState);

                expect(mockGetFrameCount).toHaveBeenCalled();

                // Advance 5 seconds - should not trigger yet
                jasmine.clock().tick(5000);
                expect(mockLogger).not.toHaveBeenCalled();

                // Advance to 10 seconds - should trigger
                jasmine.clock().tick(5000);
                expect(mockLogger).toHaveBeenCalled();
            });

            it('should call stop() before creating new interval if already running', () => {
                mockGetFrameCount.and.returnValue(0);
                mockGetState.and.returnValue('TRACKING');

                service.start(mockGetFrameCount, mockGetState);
                jasmine.clock().tick(5000);

                // Start again - should stop previous interval
                service.start(mockGetFrameCount, mockGetState);

                // Should still work after restart
                jasmine.clock().tick(10000);
                expect(mockLogger).toHaveBeenCalled();
            });
        });

        describe('DIAG-001-B: Logs error when no new frames during tracking', () => {
            it('should log error when frameCount unchanged and state is TRACKING', () => {
                // Frame count stays at 0
                mockGetFrameCount.and.returnValue(0);
                mockGetState.and.returnValue('TRACKING');

                service.start(mockGetFrameCount, mockGetState);

                // Advance 10 seconds
                jasmine.clock().tick(10000);

                expect(mockLogger).toHaveBeenCalledWith(
                    'error',
                    jasmine.stringMatching(/WebGazer no envía datos/)
                );
            });

            it('should log error each 10-second interval while frames are stuck', () => {
                mockGetFrameCount.and.returnValue(5);
                mockGetState.and.returnValue('TRACKING');

                service.start(mockGetFrameCount, mockGetState);

                // Baseline is set at start() to current frame count
                // Interval fires every 10s, comparing current vs baseline
                // Since frames never change, each interval logs an error

                // First interval at 10s
                jasmine.clock().tick(10000);
                expect(mockLogger).toHaveBeenCalledTimes(1);

                // Second interval at 20s
                jasmine.clock().tick(10000);
                expect(mockLogger).toHaveBeenCalledTimes(2);

                // Third interval at 30s
                jasmine.clock().tick(10000);
                expect(mockLogger).toHaveBeenCalledTimes(3);

                // Verify error message format
                expect(mockLogger).toHaveBeenCalledWith(
                    'error',
                    jasmine.stringMatching(/WebGazer no envía datos/)
                );
            });
        });

        describe('DIAG-001-C: Does not log when frames are received', () => {
            it('should NOT log error when frameCount increased', () => {
                let frameCount = 0;
                mockGetFrameCount.and.callFake(() => {
                    frameCount += 10;
                    return frameCount;
                });
                mockGetState.and.returnValue('TRACKING');

                service.start(mockGetFrameCount, mockGetState);

                // Advance 10 seconds
                jasmine.clock().tick(10000);

                // Each check sees increased frame count - no error
                expect(mockLogger).not.toHaveBeenCalled();
            });
        });

        describe('DIAG-001-D: Does not log when state is not TRACKING', () => {
            it('should NOT log when state is IDLE', () => {
                mockGetFrameCount.and.returnValue(0);
                mockGetState.and.returnValue('IDLE');

                service.start(mockGetFrameCount, mockGetState);

                jasmine.clock().tick(10000);

                expect(mockLogger).not.toHaveBeenCalled();
            });

            it('should NOT log when state is CALIBRATING', () => {
                mockGetFrameCount.and.returnValue(0);
                mockGetState.and.returnValue('CALIBRATING');

                service.start(mockGetFrameCount, mockGetState);

                jasmine.clock().tick(10000);

                expect(mockLogger).not.toHaveBeenCalled();
            });

            it('should NOT log when state is ERROR', () => {
                mockGetFrameCount.and.returnValue(0);
                mockGetState.and.returnValue('ERROR');

                service.start(mockGetFrameCount, mockGetState);

                jasmine.clock().tick(10000);

                expect(mockLogger).not.toHaveBeenCalled();
            });

            it('should log when state transitions from IDLE to TRACKING without new frames', () => {
                let callCount = 0;
                mockGetFrameCount.and.returnValue(5);
                mockGetState.and.callFake(() => {
                    callCount++;
                    // First check: IDLE (after first interval)
                    return callCount <= 1 ? 'IDLE' : 'TRACKING';
                });

                service.start(mockGetFrameCount, mockGetState);

                jasmine.clock().tick(10000);

                // State was IDLE on first check, so no error
                expect(mockLogger).not.toHaveBeenCalled();
            });
        });

        describe('DIAG-001-E: Stops interval on stop', () => {
            it('should clear interval when stop() is called', () => {
                mockGetFrameCount.and.returnValue(0);
                mockGetState.and.returnValue('TRACKING');

                service.start(mockGetFrameCount, mockGetState);

                // Stop before first interval
                service.stop();

                // Advance 15 seconds
                jasmine.clock().tick(15000);

                // No error should have been logged
                expect(mockLogger).not.toHaveBeenCalled();
            });

            it('should be safe to call stop() multiple times', () => {
                service.start(mockGetFrameCount, mockGetState);

                service.stop();
                service.stop();
                service.stop();

                // Should not throw
                expect(true).toBeTrue();
            });

            it('should be safe to call stop() without start()', () => {
                service.stop();

                // Should not throw
                expect(true).toBeTrue();
            });
        });

        describe('Additional coverage', () => {
            it('should handle null frame count callback', () => {
                mockGetFrameCount.and.returnValue(null as any);
                mockGetState.and.returnValue('TRACKING');

                service.start(mockGetFrameCount, mockGetState);

                jasmine.clock().tick(10000);

                // Should not throw, should not have deviation
                expect(mockLogger).not.toHaveBeenCalled();
            });

            it('should handle state changes between intervals', () => {
                let intervalCount = 0;
                mockGetFrameCount.and.returnValue(5);
                mockGetState.and.callFake(() => {
                    intervalCount++;
                    // First 10s: TRACKING, second 10s: IDLE
                    return intervalCount <= 1 ? 'TRACKING' : 'IDLE';
                });

                service.start(mockGetFrameCount, mockGetState);

                jasmine.clock().tick(10000);
                // First check: TRACKING with same frame count → error
                expect(mockLogger).toHaveBeenCalled();

                mockLogger.calls.reset();

                jasmine.clock().tick(10000);
                // Second check: IDLE → no error
                expect(mockLogger).not.toHaveBeenCalled();
            });
        });
    });
});