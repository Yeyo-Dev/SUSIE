import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { GazeTrackingFacade, GazeConfig, GazeState } from './gaze-tracking.facade';

describe('GazeTrackingFacade', () => {
    let facade: GazeTrackingFacade;
    let ngZone: NgZone;
    let loggerSpy: jasmine.Spy;
    let deviationCb: jasmine.Spy;

    let mockWebgazer: any;
    let originalMutationObserver: typeof MutationObserver;
    let capturedGazeListener: ((data: any, clock: number) => void) | null;

    let rafSpy: jasmine.Spy;
    let cafSpy: jasmine.Spy;

    function createMockWebgazer() {
        capturedGazeListener = null;
        return {
            setTracker: jasmine.createSpy('setTracker').and.callFake(function (this: any) { return this; }),
            setRegression: jasmine.createSpy('setRegression').and.callFake(function (this: any) { return this; }),
            setGazeListener: jasmine.createSpy('setGazeListener').and.callFake(function (this: any, cb: any) {
                capturedGazeListener = cb;
                return this;
            }),
            begin: jasmine.createSpy('begin').and.returnValue(Promise.resolve()),
            end: jasmine.createSpy('end'),
            resume: jasmine.createSpy('resume'),
            showVideoPreview: jasmine.createSpy('showVideoPreview').and.callFake(function (this: any) { return this; }),
            showPredictionPoints: jasmine.createSpy('showPredictionPoints').and.callFake(function (this: any) { return this; }),
            getCurrentPrediction: jasmine.createSpy('getCurrentPrediction').and.returnValue(null),
        };
    }

    beforeEach(() => {
        try { jasmine.clock().uninstall(); } catch (_) { /* no estaba instalado */ }
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date(2026, 2, 10, 12, 0, 0));

        mockWebgazer = createMockWebgazer();
        (window as any).webgazer = mockWebgazer;

        let rafCounter = 1;
        rafSpy = spyOn(window, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => {
            return rafCounter++;
        });
        cafSpy = spyOn(window, 'cancelAnimationFrame').and.callFake(() => { });

        spyOn(document, 'getElementById').and.returnValue(null);
        spyOn(document, 'querySelectorAll').and.returnValue([] as any);

        originalMutationObserver = globalThis.MutationObserver;
        (globalThis as any).MutationObserver = class MockMutationObserver {
            constructor(_cb: MutationCallback) { }
            observe() { }
            disconnect() { }
            takeRecords() { return []; }
        };

        TestBed.configureTestingModule({
            providers: [GazeTrackingFacade],
        });

        facade = TestBed.inject(GazeTrackingFacade);
        ngZone = TestBed.inject(NgZone);

        loggerSpy = jasmine.createSpy('logger');
        deviationCb = jasmine.createSpy('deviationCallback');
    });

    afterEach(() => {
        try { facade?.stop(); } catch (_) { /* ignore cleanup errors */ }
        delete (window as any).webgazer;
        if (originalMutationObserver) {
            (globalThis as any).MutationObserver = originalMutationObserver;
        }
        try { jasmine.clock().uninstall(); } catch (_) { /* ignore */ }
    });

    describe('configure()', () => {
        it('debe usar configuración por defecto sin parámetros', () => {
            facade.configure();
            expect(facade.gazeState()).toBe('IDLE');
        });

        it('debe mezclar configuración parcial con defaults', () => {
            facade.configure({ smoothingWindow: 5 }, loggerSpy);
            loggerSpy('info', 'test');
            expect(loggerSpy).toHaveBeenCalledWith('info', 'test');
        });

        it('debe almacenar el callback de desviación', () => {
            facade.configure({}, loggerSpy, deviationCb);
            expect(deviationCb).not.toHaveBeenCalled();
        });
    });

    describe('startCalibration()', () => {
        it('debe retornar false y estado ERROR si webgazer no existe', async () => {
            delete (window as any).webgazer;

            facade.configure({}, loggerSpy);
            const result = await facade.startCalibration();

            expect(result).toBeFalse();
            expect(facade.gazeState()).toBe('ERROR');
        });

        it('debe retornar true y estado CALIBRATING si webgazer existe', async () => {
            facade.configure({}, loggerSpy);
            const result = await facade.startCalibration();

            expect(result).toBeTrue();
            expect(mockWebgazer.setTracker).toHaveBeenCalledWith('TFFacemesh');
            expect(mockWebgazer.setRegression).toHaveBeenCalledWith('ridge');
            expect(mockWebgazer.begin).toHaveBeenCalled();
        });
    });

    describe('completeCalibration()', () => {
        beforeEach(async () => {
            facade.configure({}, loggerSpy, deviationCb);
            await facade.startCalibration();
        });

        it('debe cambiar gazeState a TRACKING e isCalibrated a true', () => {
            facade.completeCalibration();

            expect(facade.gazeState()).toBe('TRACKING');
            expect(facade.isCalibrated()).toBeTrue();
        });

        it('debe llamar resume() en webgazer si está disponible', () => {
            facade.completeCalibration();
            expect(mockWebgazer.resume).toHaveBeenCalled();
        });
    });

    describe('Gaze Processing', () => {
        beforeEach(async () => {
            spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
            spyOnProperty(window, 'innerHeight', 'get').and.returnValue(800);

            facade.configure({ smoothingWindow: 3, samplingIntervalMs: 100 }, loggerSpy, deviationCb);
            await facade.startCalibration();
            facade.completeCalibration();
        });

        it('debe normalizar coordenadas del centro de pantalla a ~(0,0)', () => {
            expect(capturedGazeListener).toBeDefined();
            capturedGazeListener!({ x: 500, y: 400 }, 0);

            const point = facade.lastPoint();
            expect(point).toBeTruthy();
            expect(Math.abs(point!.x)).toBeLessThan(0.1);
            expect(Math.abs(point!.y)).toBeLessThan(0.1);
        });

        it('debe ignorar datos null del gaze listener', () => {
            capturedGazeListener!(null, 0);
            expect(facade.lastPoint()).toBeNull();
        });
    });

    describe('Deviation Detection', () => {
        beforeEach(async () => {
            spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
            spyOnProperty(window, 'innerHeight', 'get').and.returnValue(800);

            facade.configure({
                deviationThreshold: 0.85,
                deviationToleranceSeconds: 3,
                smoothingWindow: 1,
                samplingIntervalMs: 100,
            }, loggerSpy, deviationCb);

            await facade.startCalibration();
            facade.completeCalibration();
        });

        it('debe reportar desviación sostenida después del período de tolerancia', () => {
            capturedGazeListener!({ x: 1000, y: 400 }, 0);

            jasmine.clock().tick(1000);
            expect(facade.hasDeviation()).toBeFalse();

            jasmine.clock().tick(1000);
            expect(facade.hasDeviation()).toBeFalse();

            jasmine.clock().tick(1000);
            expect(facade.hasDeviation()).toBeFalse();

            jasmine.clock().tick(1000);
            expect(facade.hasDeviation()).toBeTrue();
            expect(deviationCb).toHaveBeenCalled();
        });
    });

    describe('Buffer Operations', () => {
        beforeEach(async () => {
            spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
            spyOnProperty(window, 'innerHeight', 'get').and.returnValue(800);

            facade.configure({ samplingIntervalMs: 50, smoothingWindow: 1 }, loggerSpy);
            await facade.startCalibration();
            facade.completeCalibration();
        });

        it('getGazeBuffer() debe retornar copia sin limpiar', () => {
            capturedGazeListener!({ x: 500, y: 400 }, 0);
            jasmine.clock().tick(100);
            capturedGazeListener!({ x: 600, y: 400 }, 0);

            const buf1 = facade.getGazeBuffer();
            const buf2 = facade.getGazeBuffer();

            expect(buf1.length).toBe(2);
            expect(buf2.length).toBe(2);
        });

        it('flushGazeBuffer() debe retornar puntos y vaciar el buffer', () => {
            capturedGazeListener!({ x: 500, y: 400 }, 0);
            jasmine.clock().tick(100);
            capturedGazeListener!({ x: 600, y: 400 }, 0);

            const flushed = facade.flushGazeBuffer();
            expect(flushed.length).toBe(2);
            expect(facade.getGazeBuffer().length).toBe(0);
        });
    });

    describe('stop()', () => {
        it('debe llamar webgazer.end()', async () => {
            facade.configure({}, loggerSpy);
            await facade.startCalibration();
            facade.completeCalibration();

            facade.stop();

            expect(mockWebgazer.end).toHaveBeenCalled();
        });

        it('debe restablecer todo el estado a IDLE', async () => {
            facade.configure({}, loggerSpy);
            await facade.startCalibration();
            facade.completeCalibration();

            facade.stop();

            expect(facade.gazeState()).toBe('IDLE');
            expect(facade.isCalibrated()).toBeFalse();
            expect(facade.hasDeviation()).toBeFalse();
            expect(facade.lastPoint()).toBeNull();
            expect(facade.getGazeBuffer().length).toBe(0);
        });

        it('no debe fallar si se llama stop() sin haber iniciado', () => {
            expect(() => facade.stop()).not.toThrow();
        });
    });
});
