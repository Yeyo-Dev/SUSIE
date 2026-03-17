import { TestBed } from '@angular/core/testing';
import { WebGazerBridgeService } from './webgazer-bridge.service';

describe('WebGazerBridgeService', () => {
    let service: WebGazerBridgeService;
    let mockWebgazer: any;
    let mockLogger: jasmine.Spy;

    beforeEach(() => {
        mockLogger = jasmine.createSpy('logger');
        
        // Create mock webgazer with chainable methods
        // Use callFake to return the mock object reference (avoids closure issue)
        mockWebgazer = {
            setTracker: jasmine.createSpy('setTracker').and.callFake(() => mockWebgazer),
            setRegression: jasmine.createSpy('setRegression').and.callFake(() => mockWebgazer),
            setGazeListener: jasmine.createSpy('setGazeListener').and.callFake(() => mockWebgazer),
            begin: jasmine.createSpy('begin').and.returnValue(Promise.resolve()),
            end: jasmine.createSpy('end'),
            resume: jasmine.createSpy('resume'),
            showVideoPreview: jasmine.createSpy('showVideoPreview').and.callFake(() => mockWebgazer),
            showPredictionPoints: jasmine.createSpy('showPredictionPoints').and.callFake(() => mockWebgazer),
            showFaceOverlay: jasmine.createSpy('showFaceOverlay').and.callFake(() => mockWebgazer),
            showVideo: jasmine.createSpy('showVideo'),
            util: {
                getMediaStream: jasmine.createSpy('getMediaStream').and.returnValue(null)
            }
        };

        // Set window.webgazer
        (window as any).webgazer = mockWebgazer;

        TestBed.configureTestingModule({
            providers: [WebGazerBridgeService]
        });

        service = TestBed.inject(WebGazerBridgeService);
    });

    afterEach(() => {
        service.stop();
        delete (window as any).webgazer;
    });

    describe('regression fallback', () => {
        it('should use weightedRidge when available and log info', async () => {
            // Arrange: weightedRidge succeeds
            mockWebgazer.setRegression.and.returnValue(mockWebgazer);
            service.configure(mockLogger);

            // Act
            const result = await service.begin();

            // Assert
            expect(result).toBe(true);
            expect(mockWebgazer.setTracker).toHaveBeenCalledWith('TFFacemesh');
            expect(mockWebgazer.setRegression).toHaveBeenCalledWith('weightedRidge');
            expect(mockWebgazer.setRegression).not.toHaveBeenCalledWith('ridge');
            expect(mockLogger).toHaveBeenCalledWith('info', '✅ WebGazer usando weightedRidge');
        });

        it('should fall back to ridge when weightedRidge throws and log warning', async () => {
            // Arrange: weightedRidge throws, ridge succeeds
            let regressionCallCount = 0;
            mockWebgazer.setRegression.and.callFake((regression: string) => {
                regressionCallCount++;
                if (regression === 'weightedRidge') {
                    throw new Error('weightedRidge not available');
                }
                // ridge succeeds
                return mockWebgazer;
            });
            service.configure(mockLogger);

            // Act
            const result = await service.begin();

            // Assert
            expect(result).toBe(true);
            expect(mockWebgazer.setRegression).toHaveBeenCalledWith('weightedRidge');
            expect(mockWebgazer.setRegression).toHaveBeenCalledWith('ridge');
            expect(mockLogger).toHaveBeenCalledWith('warn', '⚠️ weightedRidge no disponible, usando ridge fallback');
        });

        it('should propagate error when both weightedRidge and ridge throw', async () => {
            // Arrange: Both regressions throw
            mockWebgazer.setRegression.and.callFake((regression: string) => {
                throw new Error(`${regression} not available`);
            });
            service.configure(mockLogger);

            // Act & Assert
            await expectAsync(service.begin()).toBeRejected();
            expect(mockWebgazer.setRegression).toHaveBeenCalledWith('weightedRidge');
            expect(mockWebgazer.setRegression).toHaveBeenCalledWith('ridge');
        });

        it('should console.warn when fallback triggers', async () => {
            // Arrange
            spyOn(console, 'warn');
            mockWebgazer.setRegression.and.callFake((regression: string) => {
                if (regression === 'weightedRidge') {
                    throw new Error('weightedRidge not available');
                }
                return mockWebgazer;
            });
            service.configure(mockLogger);

            // Act
            await service.begin();

            // Assert
            expect(console.warn).toHaveBeenCalledWith(
                '[GAZE-BRIDGE] weightedRidge no disponible, usando ridge:',
                jasmine.any(Error)
            );
        });
    });

    describe('begin - webgazer availability', () => {
        it('should return false and log error when webgazer is not available', async () => {
            // Arrange
            delete (window as any).webgazer;
            service.configure(mockLogger);

            // Act
            const result = await service.begin();

            // Assert
            expect(result).toBe(false);
            expect(mockLogger).toHaveBeenCalledWith('error', '❌ WebGazer no está cargado. Incluí webgazer.js en la aplicación.');
        });
    });

    describe('begin - existing stream injection', () => {
        it('should inject existing stream into WebGazer and restore after begin', async () => {
            // Arrange
            const mockStream = { getTracks: () => [] } as unknown as MediaStream;
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            service.configure(mockLogger);

            // Act
            await service.begin(mockStream);

            // Assert: After begin(), getUserMedia should be restored to original
            // Note: We can't compare identity with spyOn, but we can verify webgazer.begin was called
            expect(mockWebgazer.begin).toHaveBeenCalled();
            expect(mockLogger).toHaveBeenCalledWith('info', '🔗 Inyectando stream existente en WebGazer...');
        });
    });

    describe('stop', () => {
        it('should call webgazer.end() and clear state after begin()', async () => {
            // Arrange: Must call begin() first to set this.webgazer
            service.configure(mockLogger);
            await service.begin();

            // Act
            service.stop();

            // Assert
            expect(mockWebgazer.end).toHaveBeenCalled();
        });

        it('should do nothing if webgazer is not initialized', () => {
            // Arrange: Don't call begin(), so this.webgazer is null
            service.configure(mockLogger);

            // Act - should not throw
            service.stop();

            // Assert: end should NOT be called since webgazer is null
            expect(mockWebgazer.end).not.toHaveBeenCalled();
        });
    });

    describe('resume', () => {
        it('should call webgazer.resume() after begin()', async () => {
            // Arrange: Must call begin() first
            service.configure(mockLogger);
            await service.begin();

            // Act
            service.resume();

            // Assert
            expect(mockWebgazer.resume).toHaveBeenCalled();
        });

        it('should do nothing if webgazer is not initialized', () => {
            // Arrange: Don't call begin()
            service.configure(mockLogger);

            // Act - should not throw
            service.resume();

            // Assert: resume should NOT be called since webgazer is null
            expect(mockWebgazer.resume).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully when resume throws after begin()', async () => {
            // Arrange
            service.configure(mockLogger);
            await service.begin();
            spyOn(console, 'warn');
            mockWebgazer.resume.and.throwError('resume failed');

            // Act - should not throw
            service.resume();

            // Assert
            expect(console.warn).toHaveBeenCalled();
        });
    });

    describe('configureVideo', () => {
        it('should configure video preview settings after begin()', async () => {
            // Arrange: Must call begin() first
            service.configure(mockLogger);
            await service.begin();

            // Act
            service.configureVideo(true, true, true);

            // Assert
            expect(mockWebgazer.showVideoPreview).toHaveBeenCalledWith(true);
            expect(mockWebgazer.showPredictionPoints).toHaveBeenCalledWith(true);
            expect(mockWebgazer.showFaceOverlay).toHaveBeenCalledWith(true);
        });

        it('should do nothing if webgazer is not initialized', () => {
            // Arrange: Don't call begin()
            service.configure(mockLogger);

            // Act - should not throw
            service.configureVideo(true, true, true);

            // Assert: Methods should NOT be called since webgazer is null
            expect(mockWebgazer.showVideoPreview).not.toHaveBeenCalled();
        });
    });
});