import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DomManagerService } from './dom-manager.service';

describe('DomManagerService', () => {
    let service: DomManagerService;
    let mockLogger: jasmine.Spy;

    // Elements to clean up after each test
    const createdElementIds = [
        'webgazer-core-styles',
        'webgazer-calibration-style',
        'customGazeDot',
        'webgazer-green-overlay',
        'webgazerVideoContainer',
        'webgazerVideoFeed',
        'webgazerFaceOverlay',
    ];

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [DomManagerService]
        });
        service = TestBed.inject(DomManagerService);
        mockLogger = jasmine.createSpy('logger');
        service.configure(mockLogger);
    });

    afterEach(() => {
        // Clean up all created DOM elements
        createdElementIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // Clean up any video elements created during tests
        document.querySelectorAll('video').forEach(v => v.remove());

        // Stop aggressive muting if active
        service.stopAggressiveMuting();
        service.cleanup();
    });

    describe('DOM-001: Manage WebGazer DOM elements and video muting', () => {

        describe('DOM-001-A: Injects styles only once', () => {
            it('should add style element to document.head', () => {
                expect(document.getElementById('webgazer-core-styles')).toBeNull();

                service.injectStyles();

                const style = document.getElementById('webgazer-core-styles');
                expect(style).not.toBeNull();
                expect(style?.tagName).toBe('STYLE');
            });

            it('should not add duplicate styles on second call', () => {
                service.injectStyles();
                service.injectStyles();

                const styles = document.querySelectorAll('#webgazer-core-styles');
                expect(styles.length).toBe(1);
            });

            it('should contain correct CSS rules', () => {
                service.injectStyles();

                const style = document.getElementById('webgazer-core-styles');
                const content = style?.textContent || '';

                expect(content).toContain('#webgazerVideoContainer');
                expect(content).toContain('#webgazerVideoFeed');
                expect(content).toContain('opacity: 0.001');
            });
        });

        describe('DOM-001-B: Creates and displays custom gaze dot', () => {
            it('should create customGazeDot element in body', () => {
                expect(document.getElementById('customGazeDot')).toBeNull();

                service.showGazeDot();

                const dot = document.getElementById('customGazeDot');
                expect(dot).not.toBeNull();
                expect(dot?.tagName).toBe('DIV');
            });

            it('should apply correct styles to gaze dot', () => {
                service.showGazeDot();

                const dot = document.getElementById('customGazeDot');
                const style = dot?.style;

                expect(style?.position).toBe('fixed');
                expect(style?.zIndex).toBe('100000');
                expect(style?.width).toBe('16px');
                expect(style?.height).toBe('16px');
                expect(style?.borderRadius).toBe('50%');
                expect(style?.background).toContain('rgba(255, 50, 50');
            });

            it('should show existing gaze dot instead of creating duplicate', () => {
                service.showGazeDot();
                service.showGazeDot();

                const dots = document.querySelectorAll('#customGazeDot');
                expect(dots.length).toBe(1);
            });

            it('should set display to block when showing', () => {
                service.showGazeDot();
                service.hideGazeDot();
                service.showGazeDot();

                const dot = document.getElementById('customGazeDot');
                expect(dot?.style.display).toBe('block');
            });
        });

        describe('DOM-001-C: Updates gaze dot position', () => {
            it('should set left and top styles', () => {
                service.showGazeDot();
                service.updateGazeDot(100, 200);

                const dot = document.getElementById('customGazeDot');
                expect(dot?.style.left).toBe('100px');
                expect(dot?.style.top).toBe('200px');
            });

            it('should do nothing if gaze dot does not exist', () => {
                // Don't create the dot first
                expect(() => service.updateGazeDot(100, 200)).not.toThrow();
            });
        });

        describe('DOM-001-D: Hides gaze dot without removal', () => {
            it('should set display to none', () => {
                service.showGazeDot();
                service.hideGazeDot();

                const dot = document.getElementById('customGazeDot');
                expect(dot?.style.display).toBe('none');
            });

            it('should keep element in DOM', () => {
                service.showGazeDot();
                service.hideGazeDot();

                expect(document.getElementById('customGazeDot')).not.toBeNull();
            });

            it('should not throw if element does not exist', () => {
                expect(() => service.hideGazeDot()).not.toThrow();
            });
        });

        describe('DOM-001-E: Mutes all WebGazer videos', () => {
            it('should mute webgazerVideoFeed', () => {
                const video = document.createElement('video');
                video.id = 'webgazerVideoFeed';
                document.body.appendChild(video);

                service.muteAll();

                expect(video.muted).toBe(true);
                expect(video.volume).toBe(0);

                video.remove();
            });

            it('should mute all videos in containers', () => {
                const container = document.createElement('div');
                container.id = 'webgazerVideoContainer';
                const video = document.createElement('video');
                video.id = 'otherVideo';
                container.appendChild(video);
                document.body.appendChild(container);

                service.muteAll();

                expect(video.muted).toBe(true);

                container.remove();
            });

            it('should handle missing elements gracefully', () => {
                expect(() => service.muteAll()).not.toThrow();
            });
        });

        describe('DOM-001-F: MutationObserver silences new videos', () => {
            it('should mute videos added after observer starts', (done) => {
                service.startAggressiveMuting();

                // Simulate WebGazer adding a video
                const video = document.createElement('video');
                video.id = 'newWebgazerVideo';
                document.body.appendChild(video);

                // MutationObserver is async, need to wait for callback
                setTimeout(() => {
                    expect(video.muted).toBe(true);
                    expect(mockLogger).toHaveBeenCalledWith(
                        'info',
                        jasmine.stringMatching(/Video de WebGazer silenciado/)
                    );

                    video.remove();
                    done();
                }, 50);
            });

            it('should mute videos inside added containers', (done) => {
                service.startAggressiveMuting();

                const container = document.createElement('div');
                const video = document.createElement('video');
                container.appendChild(video);
                document.body.appendChild(container);

                setTimeout(() => {
                    expect(video.muted).toBe(true);

                    container.remove();
                    done();
                }, 50);
            });

            it('should stop observing after stopAggressiveMuting()', (done) => {
                service.startAggressiveMuting();
                service.stopAggressiveMuting();

                const video = document.createElement('video');
                video.id = 'lateVideo';
                document.body.appendChild(video);

                setTimeout(() => {
                    // Observer was stopped, video should NOT be muted by observer
                    expect(video.muted).toBe(false);

                    video.remove();
                    done();
                }, 50);
            });
        });

        describe('DOM-001-G: Cleanup removes all WebGazer elements', () => {
            it('should remove all WEBGAZER_ELEMENTS', () => {
                // Create some elements
                const container = document.createElement('div');
                container.id = 'webgazerVideoContainer';
                document.body.appendChild(container);

                const styles = document.createElement('style');
                styles.id = 'webgazer-core-styles';
                document.head.appendChild(styles);

                const dot = document.createElement('div');
                dot.id = 'customGazeDot';
                document.body.appendChild(dot);

                service.cleanup();

                expect(document.getElementById('webgazerVideoContainer')).toBeNull();
                expect(document.getElementById('webgazer-core-styles')).toBeNull();
                expect(document.getElementById('customGazeDot')).toBeNull();
            });

            it('should stop aggressive muting', () => {
                service.startAggressiveMuting();

                service.cleanup();

                // Add a video after cleanup - should not be muted by observer
                const video = document.createElement('video');
                document.body.appendChild(video);

                expect(video.muted).toBe(false);

                video.remove();
            });

            it('should handle missing elements gracefully', () => {
                expect(() => service.cleanup()).not.toThrow();
            });
        });

        describe('DOM-001-H: ConfigureVideoForCalibration applies styles', () => {
            it('should create #webgazer-calibration-style', () => {
                service.configureVideoForCalibration();

                const style = document.getElementById('webgazer-calibration-style');
                expect(style).not.toBeNull();
            });

            it('should remove existing style before creating new one', () => {
                service.configureVideoForCalibration();
                service.configureVideoForCalibration();

                const styles = document.querySelectorAll('#webgazer-calibration-style');
                expect(styles.length).toBe(1);
            });

            it('should include correct CSS rules', () => {
                service.configureVideoForCalibration();

                const style = document.getElementById('webgazer-calibration-style');
                const content = style?.textContent || '';

                expect(content).toContain('#webgazerVideoContainer');
                expect(content).toContain('opacity: 0.15');
                expect(content).toContain('z-index: 5');
            });
        });

        describe('DOM-001-I: ApplyGreenFaceOverlay injects style with retry', () => {
            it('should create style when canvas exists', (done) => {
                // Create the canvas element
                const canvas = document.createElement('canvas');
                canvas.id = 'webgazerFaceOverlay';
                document.body.appendChild(canvas);

                service.applyGreenFaceOverlay();

                // apply() runs synchronously, style should be created immediately
                setTimeout(() => {
                    const style = document.getElementById('webgazer-green-overlay');
                    expect(style).not.toBeNull();

                    canvas.remove();
                    document.getElementById('webgazer-green-overlay')?.remove();
                    done();
                }, 0);
            });

            it('should retry style injection at 500ms, 1000ms, 2000ms', (done) => {
                // No canvas initially
                service.applyGreenFaceOverlay();

                // First retry at 500ms - canvas doesn't exist yet
                setTimeout(() => {
                    // Add canvas before second retry
                    const canvas = document.createElement('canvas');
                    canvas.id = 'webgazerFaceOverlay';
                    document.body.appendChild(canvas);

                    // Wait for second retry at 1000ms
                    setTimeout(() => {
                        const style = document.getElementById('webgazer-green-overlay');
                        expect(style).not.toBeNull();

                        canvas.remove();
                        document.getElementById('webgazer-green-overlay')?.remove();
                        done();
                    }, 600); // Wait past 1000ms retry (500 + 600 ≈ 1100ms)
                }, 500);
            });

            it('should not create duplicate styles', (done) => {
                const canvas = document.createElement('canvas');
                canvas.id = 'webgazerFaceOverlay';
                document.body.appendChild(canvas);

                service.applyGreenFaceOverlay();
                service.applyGreenFaceOverlay();

                setTimeout(() => {
                    const styles = document.querySelectorAll('#webgazer-green-overlay');
                    expect(styles.length).toBe(1);

                    canvas.remove();
                    document.getElementById('webgazer-green-overlay')?.remove();
                    done();
                }, 0);
            });

            it('should apply filter styles to overlay', (done) => {
                const canvas = document.createElement('canvas');
                canvas.id = 'webgazerFaceOverlay';
                document.body.appendChild(canvas);

                service.applyGreenFaceOverlay();

                setTimeout(() => {
                    const style = document.getElementById('webgazer-green-overlay');
                    const content = style?.textContent || '';

                    expect(content).toContain('#webgazerFaceOverlay');
                    expect(content).toContain('hue-rotate');

                    canvas.remove();
                    document.getElementById('webgazer-green-overlay')?.remove();
                    done();
                }, 0);
            });
        });

        describe('Additional coverage', () => {
            it('configureVideoForExam should set container styles', () => {
                const container = document.createElement('div');
                container.id = 'webgazerVideoContainer';
                document.body.appendChild(container);

                service.configureVideoForExam();

                expect(container.style.opacity).toBe('0.001');
                expect(container.style.position).toBe('fixed');

                container.remove();
            });

            it('configureVideoForExam should handle missing elements', () => {
                expect(() => service.configureVideoForExam()).not.toThrow();
            });

            it('should inject styles with correct z-index values', () => {
                service.injectStyles();

                const style = document.getElementById('webgazer-core-styles');
                const content = style?.textContent || '';

                expect(content).toContain('z-index: 9999');
            });
        });
    });
});