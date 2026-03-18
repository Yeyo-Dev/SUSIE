import { TestBed } from '@angular/core/testing';
import { HeadPoseAnalyzerService } from './head-pose-analyzer.service';

describe('HeadPoseAnalyzerService', () => {
    let service: HeadPoseAnalyzerService;
    let mockLogger: jasmine.Spy;

    // Factory to create FaceMesh data with configurable nose position
    // FaceMesh landmark indices (from service code):
    // 1 = nose tip, 234 = left edge, 454 = right edge, 10 = top edge, 152 = bottom edge
    function createFaceMeshData(noseRelX: number, noseRelY: number): any {
        const faceWidth = 200;
        const faceHeight = 150;
        const leftEdgeX = 50;
        const topEdgeY = 50;
        const centerX = leftEdgeX + faceWidth / 2; // 150
        const centerY = topEdgeY + faceHeight / 2;  // 125

        // Calculate actual positions based on relative coordinates
        const noseX = leftEdgeX + noseRelX * faceWidth;
        const noseY = topEdgeY + noseRelY * faceHeight;

        // Create sparse array with landmarks at correct indices
        const mesh: number[][] = [];
        mesh[1] = [noseX, noseY, 0];      // nose tip (landmark 1)
        mesh[234] = [leftEdgeX, centerY, 0];  // left edge (landmark 234)
        mesh[454] = [leftEdgeX + faceWidth, centerY, 0]; // right edge (landmark 454)
        mesh[10] = [centerX, topEdgeY, 0];   // top edge (landmark 10)
        mesh[152] = [centerX, topEdgeY + faceHeight, 0]; // bottom edge (landmark 152)

        return {
            allPredictions: [{
                scaledMesh: mesh
            }]
        };
    }

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [HeadPoseAnalyzerService]
        });
        service = TestBed.inject(HeadPoseAnalyzerService);
        mockLogger = jasmine.createSpy('logger');
        service.configure(mockLogger);
    });

    describe('HPA-001: Analyze FaceMesh landmarks for head pose detection', () => {

        describe('HPA-001-A: Returns non-profile result when no predictions', () => {
            it('should return non-profile when rawData is null', () => {
                const result = service.analyze(null);
                expect(result).toEqual({
                    isProfile: false,
                    reason: null,
                    normalizedX: null,
                    normalizedY: null
                });
            });

            it('should return non-profile when rawData is undefined', () => {
                const result = service.analyze(undefined);
                expect(result).toEqual({
                    isProfile: false,
                    reason: null,
                    normalizedX: null,
                    normalizedY: null
                });
            });

            it('should return non-profile when allPredictions is empty', () => {
                const result = service.analyze({ allPredictions: [] });
                expect(result).toEqual({
                    isProfile: false,
                    reason: null,
                    normalizedX: null,
                    normalizedY: null
                });
            });
        });

        describe('HPA-001-B: Returns non-profile result when mesh is missing', () => {
            it('should return non-profile when scaledMesh is missing', () => {
                const result = service.analyze({
                    allPredictions: [{}]
                });
                expect(result).toEqual({
                    isProfile: false,
                    reason: null,
                    normalizedX: null,
                    normalizedY: null
                });
            });

            it('should return non-profile when scaledMesh is empty', () => {
                const result = service.analyze({
                    allPredictions: [{ scaledMesh: [] }]
                });
                expect(result).toEqual({
                    isProfile: false,
                    reason: null,
                    normalizedX: null,
                    normalizedY: null
                });
            });

            it('should return non-profile when required landmarks are missing', () => {
                // Missing landmarks 10 and 152 (top and bottom edges)
                const result = service.analyze({
                    allPredictions: [{
                        scaledMesh: [
                            [100, 100, 0],   // landmark 0
                            [100, 75, 0],    // landmark 1 = nose
                            [50, 100, 0],    // landmark 234 = left edge
                            [250, 100, 0],   // landmark 454 = right edge
                            // landmarks 10 and 152 missing (undefined)
                        ]
                    }]
                });
                expect(result).toEqual({
                    isProfile: false,
                    reason: null,
                    normalizedX: null,
                    normalizedY: null
                });
            });
        });

        describe('HPA-001-C: Detects yaw (horizontal head turn)', () => {
            it('should detect profile when noseRelX < 0.23 (head turned left)', () => {
                // noseRelX = 0.20 (< 0.23) → yaw detected
                const result = service.analyze(createFaceMeshData(0.20, 0.5));

                expect(result.isProfile).toBe(true);
                expect(result.reason).toBe('yaw');
                expect(result.normalizedX).toBeCloseTo(0.20, 2);
                expect(result.normalizedY).toBeCloseTo(0.5, 2);
            });

            it('should detect profile when noseRelX > 0.77 (head turned right)', () => {
                // noseRelX = 0.85 (> 0.77) → yaw detected
                const result = service.analyze(createFaceMeshData(0.85, 0.5));

                expect(result.isProfile).toBe(true);
                expect(result.reason).toBe('yaw');
                expect(result.normalizedX).toBeCloseTo(0.85, 2);
            });

            it('should detect profile at boundary value noseRelX < 0.23', () => {
                // Just below threshold
                const result = service.analyze(createFaceMeshData(0.22, 0.5));

                expect(result.isProfile).toBe(true);
                expect(result.reason).toBe('yaw');
            });

            it('should detect profile at boundary value noseRelX > 0.77', () => {
                // Just above threshold
                const result = service.analyze(createFaceMeshData(0.78, 0.5));

                expect(result.isProfile).toBe(true);
                expect(result.reason).toBe('yaw');
            });
        });

        describe('HPA-001-D: Detects pitch (vertical head tilt)', () => {
            it('should detect profile when noseRelY < 0.25 (head tilted up)', () => {
                // noseRelY = 0.20 (< 0.25) → pitch detected
                // noseRelX must be in valid range [0.23, 0.77] to test pitch
                const result = service.analyze(createFaceMeshData(0.5, 0.20));

                expect(result.isProfile).toBe(true);
                expect(result.reason).toBe('pitch');
                expect(result.normalizedY).toBeCloseTo(0.20, 2);
            });

            it('should detect profile when noseRelY > 0.64 (head tilted down)', () => {
                // noseRelY = 0.70 (> 0.64) → pitch detected
                const result = service.analyze(createFaceMeshData(0.5, 0.70));

                expect(result.isProfile).toBe(true);
                expect(result.reason).toBe('pitch');
                expect(result.normalizedY).toBeCloseTo(0.70, 2);
            });

            it('should detect profile at boundary value noseRelY < 0.25', () => {
                // Just below threshold
                const result = service.analyze(createFaceMeshData(0.5, 0.24));

                expect(result.isProfile).toBe(true);
                expect(result.reason).toBe('pitch');
            });

            it('should detect profile at boundary value noseRelY > 0.64', () => {
                // Just above threshold
                const result = service.analyze(createFaceMeshData(0.5, 0.65));

                expect(result.isProfile).toBe(true);
                expect(result.reason).toBe('pitch');
            });
        });

        describe('HPA-001-E: Returns non-profile for forward-facing head', () => {
            it('should return non-profile when head is centered (noseRelX in range, noseRelY in range)', () => {
                // noseRelX = 0.5 (in [0.23, 0.77])
                // noseRelY = 0.45 (in [0.25, 0.64])
                const result = service.analyze(createFaceMeshData(0.5, 0.45));

                expect(result.isProfile).toBe(false);
                expect(result.reason).toBeNull();
                // normalizedX and normalizedY are null when isProfile is false
                expect(result.normalizedX).toBeNull();
                expect(result.normalizedY).toBeNull();
            });

            it('should return non-profile at edge of valid range', () => {
                // noseRelX = 0.23 (at boundary, should NOT be profile)
                // noseRelY = 0.25 (at boundary, should NOT be profile)
                const result = service.analyze(createFaceMeshData(0.23, 0.25));

                expect(result.isProfile).toBe(false);
                expect(result.reason).toBeNull();
            });

            it('should return non-profile at upper edge of valid range', () => {
                // noseRelX = 0.77 (at boundary, should NOT be profile)
                // noseRelY = 0.64 (at boundary, should NOT be profile)
                const result = service.analyze(createFaceMeshData(0.77, 0.64));

                expect(result.isProfile).toBe(false);
                expect(result.reason).toBeNull();
            });
        });

        describe('HPA-001-F: Logs warnings with 3-second throttle', () => {
            beforeEach(() => {
                jasmine.clock().uninstall();
                jasmine.clock().install();
                // Reset the service's internal throttle state
                service.configure(mockLogger);
            });

            afterEach(() => {
                jasmine.clock().uninstall();
            });

            it('should log warning once per 3-second window for yaw', () => {
                const baseTime = Date.now();
                jasmine.clock().mockDate(new Date(baseTime));

                // Trigger yaw detection
                service.analyze(createFaceMeshData(0.10, 0.5));
                expect(mockLogger).toHaveBeenCalledTimes(1);
                expect(mockLogger).toHaveBeenCalledWith(
                    'warn',
                    jasmine.stringMatching(/Perfil detectado — Yaw/)
                );

                // Second detection within 3 seconds - should NOT log
                jasmine.clock().tick(2000);
                jasmine.clock().mockDate(new Date(baseTime + 2000));
                service.analyze(createFaceMeshData(0.15, 0.5));
                expect(mockLogger).toHaveBeenCalledTimes(1); // Still 1

                // Advance time by 3 more seconds (total 5 seconds from start)
                jasmine.clock().tick(3000);
                jasmine.clock().mockDate(new Date(baseTime + 5000));

                // Third detection after throttle window - should log
                service.analyze(createFaceMeshData(0.12, 0.5));
                expect(mockLogger).toHaveBeenCalledTimes(2);
            });

            it('should log warning once per 3-second window for pitch', () => {
                const baseTime = Date.now();
                jasmine.clock().mockDate(new Date(baseTime));

                // Trigger pitch detection
                service.analyze(createFaceMeshData(0.5, 0.15));
                expect(mockLogger).toHaveBeenCalledTimes(1);
                expect(mockLogger).toHaveBeenCalledWith(
                    'warn',
                    jasmine.stringMatching(/Perfil detectado — Pitch/)
                );

                // Second detection within 3 seconds - should NOT log
                jasmine.clock().tick(2000);
                jasmine.clock().mockDate(new Date(baseTime + 2000));
                service.analyze(createFaceMeshData(0.5, 0.10));
                expect(mockLogger).toHaveBeenCalledTimes(1);

                // Advance time by 3 more seconds (total 5 seconds)
                jasmine.clock().tick(3000);
                jasmine.clock().mockDate(new Date(baseTime + 5000));

                // Third detection after throttle window - should log
                service.analyze(createFaceMeshData(0.5, 0.20));
                expect(mockLogger).toHaveBeenCalledTimes(2);
            });

            it('should NOT log when head pose is normal', () => {
                service.analyze(createFaceMeshData(0.5, 0.5));
                service.analyze(createFaceMeshData(0.4, 0.4));
                service.analyze(createFaceMeshData(0.6, 0.6));

                expect(mockLogger).not.toHaveBeenCalled();
            });
        });
    });

    describe('Edge cases', () => {
        it('should handle very small face dimensions gracefully', () => {
            // Face too small (< 10px width/height) should return non-profile
            const smallFaceData = {
                allPredictions: [{
                    scaledMesh: [
                        [0, 0, 0],
                        [5, 5, 0],    // nose
                        [0, 5, 0],    // left edge
                        [8, 5, 0],    // right edge (< 10px width)
                        [4, 0, 0],    // top edge
                        [4, 8, 0],    // bottom edge (< 10px height)
                    ]
                }]
            };

            const result = service.analyze(smallFaceData);
            expect(result.isProfile).toBe(false);
        });

        it('should handle exceptions gracefully', () => {
            // Pass data that would cause an exception (missing properties)
            const badData = {
                allPredictions: [{
                    scaledMesh: 'not an array'
                }]
            };

            const result = service.analyze(badData);
            expect(result.isProfile).toBe(false);
        });
    });
});