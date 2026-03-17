import { TestBed } from '@angular/core/testing';
import { GazeTrackingFacadeService } from './gaze-tracking.facade';
import { WebGazerBridgeService } from './webgazer-bridge.service';
import { CalibrationService } from './calibration.service';
import { SignalSmoothingService } from './signal-smoothing.service';
import { FaceDetectionService } from './face-detection.service';
import { DeviationDetectionService } from './deviation-detection.service';
import { HeadPoseAnalyzerService, HeadPoseResult } from './head-pose-analyzer.service';
import { DomManagerService } from './dom-manager.service';
import { GazeDiagnosticsService } from './gaze-diagnostics.service';
import { RawGazeEvent } from './gaze.interfaces';

describe('GazeTrackingFacadeService', () => {
    let service: GazeTrackingFacadeService;
    let mockBridge: jasmine.SpyObj<WebGazerBridgeService>;
    let mockCalibration: jasmine.SpyObj<CalibrationService>;
    let mockSmoothing: jasmine.SpyObj<SignalSmoothingService>;
    let mockFaceDetection: jasmine.SpyObj<FaceDetectionService>;
    let mockDeviationDetection: jasmine.SpyObj<DeviationDetectionService>;
    let mockHeadPose: jasmine.SpyObj<HeadPoseAnalyzerService>;
    let mockDomManager: jasmine.SpyObj<DomManagerService>;
    let mockDiagnostics: jasmine.SpyObj<GazeDiagnosticsService>;

    // Default head pose result (not profile)
    const noProfileResult: HeadPoseResult = {
        isProfile: false,
        reason: null,
        normalizedX: null,
        normalizedY: null
    };

    const profileResult: HeadPoseResult = {
        isProfile: true,
        reason: 'yaw',
        normalizedX: 0.5,
        normalizedY: 0.5
    };

    beforeEach(() => {
        mockBridge = jasmine.createSpyObj('WebGazerBridgeService', [
            'begin', 'stop', 'resume', 'onGaze', 'onNoFace',
            'configure', 'configureVideo', 'showVideo', 'showFaceOverlay'
        ], { instance: null });

        mockCalibration = jasmine.createSpyObj('CalibrationService', [
            'start', 'complete', 'recordClick', 'recordCalibrationFrame',
            'recordTrackingFrame', 'recordConfidence', 'getMetrics', 'configure'
        ]);

        mockSmoothing = jasmine.createSpyObj('SignalSmoothingService', [
            'process', 'reset', 'configure'
        ], {});

        mockFaceDetection = jasmine.createSpyObj('FaceDetectionService', [
            'configure', 'handleNoFace', 'handleFaceDetected', 'reset'
        ], {});

        mockDeviationDetection = jasmine.createSpyObj('DeviationDetectionService', [
            'configure', 'start', 'destroy', 'hasDeviation'
        ], {});

        mockHeadPose = jasmine.createSpyObj('HeadPoseAnalyzerService', [
            'configure', 'analyze'
        ]);

        mockDomManager = jasmine.createSpyObj('DomManagerService', [
            'configure', 'injectStyles', 'startAggressiveMuting', 'muteAll',
            'applyGreenFaceOverlay', 'configureVideoForCalibration', 'showGazeDot',
            'hideGazeDot', 'configureVideoForExam', 'updateGazeDot', 'cleanup'
        ]);

        mockDiagnostics = jasmine.createSpyObj('GazeDiagnosticsService', [
            'configure', 'start', 'stop'
        ]);

        TestBed.configureTestingModule({
            providers: [
                GazeTrackingFacadeService,
                { provide: WebGazerBridgeService, useValue: mockBridge },
                { provide: CalibrationService, useValue: mockCalibration },
                { provide: SignalSmoothingService, useValue: mockSmoothing },
                { provide: FaceDetectionService, useValue: mockFaceDetection },
                { provide: DeviationDetectionService, useValue: mockDeviationDetection },
                { provide: HeadPoseAnalyzerService, useValue: mockHeadPose },
                { provide: DomManagerService, useValue: mockDomManager },
                { provide: GazeDiagnosticsService, useValue: mockDiagnostics }
            ]
        });

        service = TestBed.inject(GazeTrackingFacadeService);
    });

    // Task 5.4: Integration tests for full pipeline - confidence propagation
    describe('confidence propagation through pipeline', () => {
        it('should pass high confidence (0.9) through to smoothing service', (done) => {
            // Task 5.4, Test case 1: Mock WebGazer data with high confidence (0.9)
            let capturedCallback: ((event: RawGazeEvent) => void) | undefined;
            
            mockBridge.onGaze.and.callFake((cb: (event: RawGazeEvent) => void) => {
                capturedCallback = cb;
            });
            mockBridge.begin.and.returnValue(Promise.resolve(true));
            mockHeadPose.analyze.and.returnValue(noProfileResult);
            mockSmoothing.process.and.returnValue({ x: 0.5, y: -0.3, ts: Date.now() });

            service.configure({}, () => {});
            service.startCalibration().then(() => {
                expect(capturedCallback).toBeDefined();

                const event: RawGazeEvent = {
                    rawX: 960,
                    rawY: 540,
                    confidence: 0.9,
                    rawData: {}
                };

                capturedCallback!(event);

                expect(mockSmoothing.process).toHaveBeenCalled();
                const callArgs = mockSmoothing.process.calls.mostRecent().args;
                expect(callArgs[0]).toBe(960);
                expect(callArgs[1]).toBe(540);
                expect(callArgs[2]).toBe(0.9);
                done();
            });
        });

        it('should pass low confidence (0.3) through to smoothing service', (done) => {
            // Task 5.4, Test case 2
            let capturedCallback: ((event: RawGazeEvent) => void) | undefined;
            
            mockBridge.onGaze.and.callFake((cb: (event: RawGazeEvent) => void) => {
                capturedCallback = cb;
            });
            mockBridge.begin.and.returnValue(Promise.resolve(true));
            mockHeadPose.analyze.and.returnValue(noProfileResult);
            mockSmoothing.process.and.returnValue({ x: 0.5, y: -0.3, ts: Date.now() });

            service.configure({}, () => {});
            service.startCalibration().then(() => {
                const event: RawGazeEvent = {
                    rawX: 500,
                    rawY: 300,
                    confidence: 0.3,
                    rawData: {}
                };

                capturedCallback!(event);

                expect(mockSmoothing.process).toHaveBeenCalled();
                const callArgs = mockSmoothing.process.calls.mostRecent().args;
                expect(callArgs[2]).toBe(0.3);
                done();
            });
        });

        it('should handle null confidence gracefully', (done) => {
            let capturedCallback: ((event: RawGazeEvent) => void) | undefined;
            
            mockBridge.onGaze.and.callFake((cb: (event: RawGazeEvent) => void) => {
                capturedCallback = cb;
            });
            mockBridge.begin.and.returnValue(Promise.resolve(true));
            mockHeadPose.analyze.and.returnValue(noProfileResult);
            mockSmoothing.process.and.returnValue({ x: 0.5, y: -0.3, ts: Date.now() });

            service.configure({}, () => {});
            service.startCalibration().then(() => {
                const event: RawGazeEvent = {
                    rawX: 800,
                    rawY: 400,
                    confidence: null,
                    rawData: {}
                };

                capturedCallback!(event);

                expect(mockSmoothing.process).toHaveBeenCalled();
                const callArgs = mockSmoothing.process.calls.mostRecent().args;
                expect(callArgs[2]).toBeUndefined();
                done();
            });
        });

        it('should detect outlier spike (smoothing returns null)', (done) => {
            // Task 5.4, Test case 3: Spike from blink → frame rejected
            let capturedCallback: ((event: RawGazeEvent) => void) | undefined;
            
            mockBridge.onGaze.and.callFake((cb: (event: RawGazeEvent) => void) => {
                capturedCallback = cb;
            });
            mockBridge.begin.and.returnValue(Promise.resolve(true));
            mockHeadPose.analyze.and.returnValue(noProfileResult);
            mockSmoothing.process.and.returnValue({ x: 0.5, y: 0.5, ts: Date.now() });

            service.configure({}, () => {});
            service.startCalibration().then(() => {
                // First valid frame
                const validEvent: RawGazeEvent = {
                    rawX: 960,
                    rawY: 540,
                    confidence: 0.9,
                    rawData: {}
                };
                capturedCallback!(validEvent);

                // Simulate blink spike - smoothing returns null for outlier
                mockSmoothing.process.and.returnValue(null);
                const spikeEvent: RawGazeEvent = {
                    rawX: 50,
                    rawY: 50,
                    confidence: 0.9,
                    rawData: {}
                };
                capturedCallback!(spikeEvent);

                // Smoothing should have been called for both frames
                expect(mockSmoothing.process).toHaveBeenCalledTimes(2);
                done();
            });
        });

        it('should process multiple frames with weighted averaging', (done) => {
            // Task 5.4, Test case 4: Multiple frames → predictable processing
            let capturedCallback: ((event: RawGazeEvent) => void) | undefined;
            
            mockBridge.onGaze.and.callFake((cb: (event: RawGazeEvent) => void) => {
                capturedCallback = cb;
            });
            mockBridge.begin.and.returnValue(Promise.resolve(true));
            mockHeadPose.analyze.and.returnValue(noProfileResult);
            mockSmoothing.process.and.returnValue({ x: 0.5, y: -0.3, ts: Date.now() });

            service.configure({}, () => {});
            service.startCalibration().then(() => {
                // Process multiple frames
                for (let i = 0; i < 5; i++) {
                    const event: RawGazeEvent = {
                        rawX: 960 + i * 10,
                        rawY: 540,
                        confidence: 0.85,
                        rawData: {}
                    };
                    capturedCallback!(event);
                }

                expect(mockSmoothing.process).toHaveBeenCalledTimes(5);
                done();
            });
        });
    });

    describe('low confidence rejection', () => {
        it('should call handleNoFace when confidence < 0.6 during TRACKING state', (done) => {
            let capturedCallback: ((event: RawGazeEvent) => void) | undefined;
            
            mockBridge.onGaze.and.callFake((cb: (event: RawGazeEvent) => void) => {
                capturedCallback = cb;
            });
            mockBridge.begin.and.returnValue(Promise.resolve(true));
            mockHeadPose.analyze.and.returnValue(noProfileResult);
            mockSmoothing.process.and.returnValue({ x: 0.5, y: 0.3, ts: Date.now() });

            service.configure({}, () => {});
            service.startCalibration().then(() => {
                // Complete calibration to enter TRACKING state
                (service as any).gazeState.set('TRACKING');
                (service as any).isCalibrated.set(true);

                const event: RawGazeEvent = {
                    rawX: 960,
                    rawY: 540,
                    confidence: 0.5, // Below 0.6 threshold
                    rawData: {}
                };

                capturedCallback!(event);

                expect(mockFaceDetection.handleNoFace).toHaveBeenCalled();
                // Smoothing should NOT be called for low confidence during TRACKING
                expect(mockSmoothing.process).not.toHaveBeenCalled();
                done();
            });
        });
    });

    describe('profile detection', () => {
        it('should call handleNoFace when profile is detected', (done) => {
            let capturedCallback: ((event: RawGazeEvent) => void) | undefined;
            
            mockBridge.onGaze.and.callFake((cb: (event: RawGazeEvent) => void) => {
                capturedCallback = cb;
            });
            mockBridge.begin.and.returnValue(Promise.resolve(true));
            mockHeadPose.analyze.and.returnValue(profileResult);
            mockSmoothing.process.and.returnValue({ x: 0.5, y: 0.3, ts: Date.now() });

            service.configure({}, () => {});
            service.startCalibration().then(() => {
                // Complete calibration to enter TRACKING state
                (service as any).gazeState.set('TRACKING');
                (service as any).isCalibrated.set(true);

                const event: RawGazeEvent = {
                    rawX: 960,
                    rawY: 540,
                    confidence: 0.9,
                    rawData: {}
                };

                capturedCallback!(event);

                expect(mockFaceDetection.handleNoFace).toHaveBeenCalled();
                expect(mockSmoothing.process).not.toHaveBeenCalled();
                done();
            });
        });
    });

    describe('configure', () => {
        it('should configure smoothing window', () => {
            service.configure({ smoothingWindow: 15 });
            expect(mockSmoothing.configure).toHaveBeenCalledWith(15);
        });

        it('should configure deviation threshold', () => {
            const onDeviation = jasmine.createSpy('onDeviation');
            service.configure({ deviationThreshold: 0.75 }, undefined, onDeviation);
            
            expect(mockDeviationDetection.configure).toHaveBeenCalled();
        });
    });

    describe('stop', () => {
        it('should reset smoothing on stop', () => {
            service.stop();
            expect(mockSmoothing.reset).toHaveBeenCalled();
            expect(mockBridge.stop).toHaveBeenCalled();
            expect(mockDeviationDetection.destroy).toHaveBeenCalled();
        });
    });

    describe('reset and state management', () => {
        it('should reset smoothing service', () => {
            service.stop();
            expect(mockSmoothing.reset).toHaveBeenCalled();
        });

        it('should reset face detection', () => {
            service.stop();
            expect(mockFaceDetection.reset).toHaveBeenCalled();
        });
    });
});