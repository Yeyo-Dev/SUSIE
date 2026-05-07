import { TestBed, inject } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { FaceDetectionService } from './face-detection.service';

describe('FaceDetectionService', () => {
    let service: FaceDetectionService;
    let mockLogger: jasmine.Spy;
    let mockOnNoFace: jasmine.Spy;
    let mockOnFaceRecovered: jasmine.Spy;

    beforeEach(() => {
        jasmine.clock().uninstall();
        jasmine.clock().install();
        TestBed.configureTestingModule({
            providers: [FaceDetectionService]
        });
        service = TestBed.inject(FaceDetectionService);
        mockLogger = jasmine.createSpy('logger');
        mockOnNoFace = jasmine.createSpy('onNoFace');
        mockOnFaceRecovered = jasmine.createSpy('onFaceRecovered');
        service.configure(mockLogger, mockOnNoFace, mockOnFaceRecovered);
    });

    afterEach(() => {
        service.destroy();
        jasmine.clock().uninstall();
    });

    describe('FACE-001: Manage face loss grace period and countdown', () => {

        describe('FACE-001-A: Ignores no-face when face already lost', () => {
            it('should ignore handleNoFace() when isFaceDetected is already false', () => {
                // First call: lose face
                service.handleNoFace();
                expect((service as any).isFaceDetected()).toBe(false);

                mockLogger.calls.reset();

                // Second call: should be ignored (no new timer)
                service.handleNoFace();

                // No additional logger calls
                expect(mockLogger).not.toHaveBeenCalled();
            });

            it('should not create duplicate timers on repeated handleNoFace() calls', () => {
                service.handleNoFace();
                service.handleNoFace();
                service.handleNoFace();

                // Only one grace period timer should be created
                // After 3 seconds, only one countdown should start
                jasmine.clock().tick(3000);

                // Should only have one set of countdown-related behavior
                expect((service as any).isCountdownVisible()).toBe(true);
            });
        });

        describe('FACE-001-B: Starts grace period on first no-face', () => {
            it('should set isFaceDetected to false on handleNoFace()', () => {
                expect((service as any).isFaceDetected()).toBe(true);

                service.handleNoFace();

                expect((service as any).isFaceDetected()).toBe(false);
            });

            it('should start grace period timer but not show countdown immediately', () => {
                service.handleNoFace();

                // Grace period: countdown not visible yet
                expect((service as any).isCountdownVisible()).toBe(false);
                expect((service as any).countdownValue()).toBe(10);

                // Advance 1 second of grace period
                jasmine.clock().tick(1000);
                expect((service as any).isCountdownVisible()).toBe(false);

                // Advance to 3 seconds
                jasmine.clock().tick(2000);
                expect((service as any).isCountdownVisible()).toBe(true);
            });
        });

        describe('FACE-001-C: Shows countdown after grace period', () => {
            it('should show countdown and set value to 10 after 3 second grace period', () => {
                service.handleNoFace();

                expect((service as any).isCountdownVisible()).toBe(false);

                jasmine.clock().tick(3000);

                expect((service as any).isCountdownVisible()).toBe(true);
                expect((service as any).countdownValue()).toBe(10);
                expect(mockLogger).toHaveBeenCalledWith(
                    'warn',
                    jasmine.stringMatching(/10 segundos/)
                );
            });

            it('should count down from 10 to 9 after first second of countdown', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period

                expect((service as any).countdownValue()).toBe(10);

                jasmine.clock().tick(1000); // First countdown tick

                expect((service as any).countdownValue()).toBe(9);
            });

            it('should decrement countdown every second', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period

                for (let i = 10; i >= 0; i--) {
                    expect((service as any).countdownValue()).toBe(i);
                    jasmine.clock().tick(1000);
                }
            });
        });

        describe('FACE-001-D: Triggers infraction after countdown', () => {
            it('should invoke noFaceCallback when countdown reaches 0', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period (3s)
                jasmine.clock().tick(10000); // Countdown (10s)
                jasmine.clock().tick(1000); // Extra tick for the 0 → infraction transition

                expect(mockOnNoFace).toHaveBeenCalled();
            });

            it('should reset state after infraction triggered', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period
                jasmine.clock().tick(10000); // Countdown
                jasmine.clock().tick(1000); // Trigger infraction

                expect((service as any).isFaceDetected()).toBe(true);
                expect((service as any).isCountdownVisible()).toBe(false);
                expect((service as any).countdownValue()).toBe(10);
            });

            it('should log error when infraction triggered', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period
                jasmine.clock().tick(10000); // Countdown
                jasmine.clock().tick(1000); // Trigger

                expect(mockLogger).toHaveBeenCalledWith(
                    'error',
                    jasmine.stringMatching(/INFRACCIÓN/)
                );
            });
        });

        describe('FACE-001-E: Recovers on face re-detection during countdown', () => {
            it('should return true when handleFaceDetected() called during countdown', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period
                jasmine.clock().tick(5000); // 5 seconds into countdown (value = 5)

                const wasLost = service.handleFaceDetected();

                expect(wasLost).toBe(true);
            });

            it('should clear all timers on recovery', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period
                jasmine.clock().tick(5000); // Partway through countdown

                service.handleFaceDetected();

                // Timers cleared - countdown should not continue
                jasmine.clock().tick(5000);
                expect(mockOnNoFace).not.toHaveBeenCalled();
            });

            it('should invoke onFaceRecovered callback', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period
                jasmine.clock().tick(3000); // Partway through countdown

                service.handleFaceDetected();

                expect(mockOnFaceRecovered).toHaveBeenCalled();
            });

            it('should reset signals on recovery', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period

                service.handleFaceDetected();

                expect((service as any).isFaceDetected()).toBe(true);
                expect((service as any).isCountdownVisible()).toBe(false);
                expect((service as any).countdownValue()).toBe(10);
            });
        });

        describe('FACE-001-F: Recovers during grace period', () => {
            it('should clear grace timer when face detected during grace period', () => {
                service.handleNoFace();
                jasmine.clock().tick(1000); // Only 1 second of grace period (not full 3s)

                service.handleFaceDetected();

                // Countdown should not appear after 3 seconds total
                jasmine.clock().tick(2000);
                expect((service as any).isCountdownVisible()).toBe(false);
            });

            it('should reset isFaceDetected to true', () => {
                service.handleNoFace();
                expect((service as any).isFaceDetected()).toBe(false);

                service.handleFaceDetected();

                expect((service as any).isFaceDetected()).toBe(true);
            });

            it('should invoke onFaceRecovered during grace period', () => {
                service.handleNoFace();
                jasmine.clock().tick(1000); // Grace period

                service.handleFaceDetected();

                // onFaceRecovered is always called in handleFaceDetected
                expect(mockOnFaceRecovered).toHaveBeenCalled();
            });
        });

        describe('FACE-001-G: Reset clears all timers and signals', () => {
            it('should clear grace period timer on reset()', () => {
                service.handleNoFace();
                jasmine.clock().tick(1000); // Partway through grace period

                service.reset();

                jasmine.clock().tick(5000); // Advance past when countdown would start

                expect((service as any).isCountdownVisible()).toBe(false);
            });

            it('should clear countdown interval on reset()', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period
                jasmine.clock().tick(3000); // Partway through countdown

                service.reset();

                jasmine.clock().tick(10000); // Advance past when infraction would trigger

                expect(mockOnNoFace).not.toHaveBeenCalled();
            });

            it('should reset signals to initial state', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000); // Grace period - countdown visible

                service.reset();

                expect((service as any).isFaceDetected()).toBe(true);
                expect((service as any).isCountdownVisible()).toBe(false);
                expect((service as any).countdownValue()).toBe(10);
            });

            it('should be safe to call reset() multiple times', () => {
                service.handleNoFace();
                jasmine.clock().tick(3000);

                service.reset();
                service.reset();
                service.reset();

                expect(true).toBeTrue(); // No error
            });
        });

        describe('Additional coverage', () => {
            it('handleFaceDetected() should return false when face was not lost', () => {
                // Face never lost
                const wasLost = service.handleFaceDetected();

                expect(wasLost).toBe(false);
            });

            it('configure() without callbacks should not throw', () => {
                service.configure(mockLogger); // No callbacks
                service.handleNoFace();
                jasmine.clock().tick(14000); // Full sequence including grace period

                // onNoFace callback is undefined, should not throw
                expect(true).toBeTrue();
            });

            it('should handle multiple start-stop cycles correctly', () => {
                // First cycle
                service.handleNoFace();
                jasmine.clock().tick(3000);
                service.handleFaceDetected();

                // Second cycle
                service.handleNoFace();
                jasmine.clock().tick(3000);
                expect((service as any).isCountdownVisible()).toBe(true);

                service.handleFaceDetected();
                expect((service as any).isFaceDetected()).toBe(true);
            });
        });
    });
});