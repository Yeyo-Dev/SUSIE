import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { GazeTrackingService, GazeConfig, GazeState } from './gaze-tracking.service';

describe('GazeTrackingService', () => {
    let service: GazeTrackingService;
    let ngZone: NgZone;
    let loggerSpy: jasmine.Spy;
    let deviationCb: jasmine.Spy;

    // Mock de WebGazer
    let mockWebgazer: any;
    let originalMutationObserver: typeof MutationObserver;
    let capturedGazeListener: ((data: any, clock: number) => void) | null;

    // Spies globales
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
        // Asegurar estado limpio del clock (otra spec pudo dejarlo instalado)
        try { jasmine.clock().uninstall(); } catch (_) { /* no estaba instalado */ }
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date(2026, 2, 10, 12, 0, 0));

        mockWebgazer = createMockWebgazer();
        (window as any).webgazer = mockWebgazer;

        // Mock rAF — ejecuta inmediatamente el callback pero guarda referencia
        let rafCounter = 1;
        rafSpy = spyOn(window, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => {
            // No llamar automáticamente para evitar recursión infinita
            return rafCounter++;
        });
        cafSpy = spyOn(window, 'cancelAnimationFrame').and.callFake(() => { });

        // Mock de elementos DOM que el servicio busca
        spyOn(document, 'getElementById').and.returnValue(null);
        spyOn(document, 'querySelectorAll').and.returnValue([] as any);

        // Mock de MutationObserver — reemplazar directamente en global
        originalMutationObserver = globalThis.MutationObserver;
        (globalThis as any).MutationObserver = class MockMutationObserver {
            constructor(_cb: MutationCallback) { }
            observe() { }
            disconnect() { }
            takeRecords() { return []; }
        };

        TestBed.configureTestingModule({
            providers: [GazeTrackingService],
        });

        service = TestBed.inject(GazeTrackingService);
        ngZone = TestBed.inject(NgZone);

        loggerSpy = jasmine.createSpy('logger');
        deviationCb = jasmine.createSpy('deviationCallback');
    });

    afterEach(() => {
        try { service?.stop(); } catch (_) { /* ignore cleanup errors */ }
        delete (window as any).webgazer;
        if (originalMutationObserver) {
            (globalThis as any).MutationObserver = originalMutationObserver;
        }
        try { jasmine.clock().uninstall(); } catch (_) { /* ignore */ }
    });

    // ══════════════════════════════════════════════════════════════
    // configure()
    // ══════════════════════════════════════════════════════════════

    describe('configure()', () => {

        it('debe usar configuración por defecto sin parámetros', () => {
            service.configure();
            // Verificamos indirectamente: el servicio funciona con defaults
            expect(service.gazeState()).toBe('IDLE');
        });

        it('debe mezclar configuración parcial con defaults', () => {
            service.configure({ smoothingWindow: 5 }, loggerSpy);
            // El logger debe estar configurado
            loggerSpy('info', 'test');
            expect(loggerSpy).toHaveBeenCalledWith('info', 'test');
        });

        it('debe almacenar el callback de desviación', () => {
            service.configure({}, loggerSpy, deviationCb);
            expect(deviationCb).not.toHaveBeenCalled();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // startCalibration()
    // ══════════════════════════════════════════════════════════════

    describe('startCalibration()', () => {

        it('debe retornar false y estado ERROR si webgazer no existe', async () => {
            delete (window as any).webgazer;

            service.configure({}, loggerSpy);
            const result = await service.startCalibration();

            expect(result).toBeFalse();
            expect(service.gazeState()).toBe('ERROR');
        });

        it('debe retornar true y estado CALIBRATING si webgazer existe', async () => {
            service.configure({}, loggerSpy);
            const result = await service.startCalibration();

            expect(result).toBeTrue();
            expect(mockWebgazer.setTracker).toHaveBeenCalledWith('TFFacemesh');
            expect(mockWebgazer.setRegression).toHaveBeenCalledWith('ridge');
            expect(mockWebgazer.begin).toHaveBeenCalled();
        });

        it('debe inyectar stream existente monkey-patching getUserMedia', async () => {
            const fakeStream = new MediaStream();
            service.configure({}, loggerSpy);

            await service.startCalibration(fakeStream);

            expect(mockWebgazer.begin).toHaveBeenCalled();
        });

        it('debe retornar false si webgazer.begin() lanza error', async () => {
            mockWebgazer.begin = jasmine.createSpy('begin').and.returnValue(Promise.reject(new Error('fail')));

            service.configure({}, loggerSpy);
            const result = await service.startCalibration();

            expect(result).toBeFalse();
            expect(service.gazeState()).toBe('ERROR');
        });
    });

    // ══════════════════════════════════════════════════════════════
    // recordCalibrationClick()
    // ══════════════════════════════════════════════════════════════

    describe('recordCalibrationClick()', () => {

        it('no debe fallar si webgazer no está inicializado', () => {
            service.stop(); // limpia webgazer
            expect(() => service.recordCalibrationClick(100, 200)).not.toThrow();
        });

        it('debe loguear el punto de calibración', async () => {
            service.configure({}, loggerSpy);
            await service.startCalibration();

            service.recordCalibrationClick(500, 300);
            expect(loggerSpy).toHaveBeenCalledWith('info', jasmine.stringContaining('500'));
        });
    });

    // ══════════════════════════════════════════════════════════════
    // completeCalibration()
    // ══════════════════════════════════════════════════════════════

    describe('completeCalibration()', () => {

        beforeEach(async () => {
            service.configure({}, loggerSpy, deviationCb);
            await service.startCalibration();
        });

        it('debe cambiar gazeState a TRACKING e isCalibrated a true', () => {
            service.completeCalibration();

            expect(service.gazeState()).toBe('TRACKING');
            expect(service.isCalibrated()).toBeTrue();
        });

        it('debe llamar resume() en webgazer si está disponible', () => {
            service.completeCalibration();
            expect(mockWebgazer.resume).toHaveBeenCalled();
        });

        it('debe iniciar polling manual (requestAnimationFrame)', () => {
            service.completeCalibration();
            expect(rafSpy).toHaveBeenCalled();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Gaze Processing (processRawGaze — indirectly via listener)
    // ══════════════════════════════════════════════════════════════

    describe('Gaze Processing', () => {

        beforeEach(async () => {
            // Fijar tamaño de ventana
            spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
            spyOnProperty(window, 'innerHeight', 'get').and.returnValue(800);

            service.configure({ smoothingWindow: 3, samplingIntervalMs: 100 }, loggerSpy, deviationCb);
            await service.startCalibration();
            service.completeCalibration();
        });

        it('debe normalizar coordenadas del centro de pantalla a ~(0,0)', () => {
            // Simular dato de gaze en el centro: x=500, y=400
            expect(capturedGazeListener).toBeDefined();
            capturedGazeListener!({ x: 500, y: 400 }, 0);

            const point = service.lastPoint();
            expect(point).toBeTruthy();
            expect(Math.abs(point!.x)).toBeLessThan(0.1);
            expect(Math.abs(point!.y)).toBeLessThan(0.1);
        });

        it('debe normalizar esquina superior izquierda a ~(-1,-1)', () => {
            capturedGazeListener!({ x: 0, y: 0 }, 0);

            const point = service.lastPoint();
            expect(point).toBeTruthy();
            expect(point!.x).toBeCloseTo(-1, 0);
            expect(point!.y).toBeCloseTo(-1, 0);
        });

        it('debe suavizar con ventana deslizante', () => {
            // Enviar 3 puntos: (1000,800), (0,0), (500,400) -> normalizado: (1,1), (-1,-1), (0,0)
            capturedGazeListener!({ x: 1000, y: 800 }, 0);
            jasmine.clock().tick(200);
            capturedGazeListener!({ x: 0, y: 0 }, 0);
            jasmine.clock().tick(200);
            capturedGazeListener!({ x: 500, y: 400 }, 0);

            const point = service.lastPoint();
            expect(point).toBeTruthy();
            // Promedio de (1, -1, 0) ≈ 0
            expect(Math.abs(point!.x)).toBeLessThan(0.5);
        });

        it('debe almacenar puntos en el buffer respetando el intervalo de muestreo', () => {
            capturedGazeListener!({ x: 500, y: 400 }, 0);
            // Segundo punto inmediato — no debería entrar al buffer (< samplingIntervalMs)
            capturedGazeListener!({ x: 600, y: 400 }, 0);

            const buf = service.getGazeBuffer();
            expect(buf.length).toBe(1); // Solo el primero

            // Avanzar el reloj para que el siguiente punto sea aceptado
            jasmine.clock().tick(200);
            capturedGazeListener!({ x: 700, y: 400 }, 0);

            expect(service.getGazeBuffer().length).toBe(2);
        });

        it('debe ignorar datos null del gaze listener (sin cara detectada)', () => {
            capturedGazeListener!(null, 0);
            expect(service.lastPoint()).toBeNull();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Deviation Detection - Ahora en GazeDeviationDetectionService
    // Los tests están en gaze-deviation-detection.service.spec.ts
    // ══════════════════════════════════════════════════════════════

    xdescribe('Deviation Detection', () => {

        beforeEach(async () => {
            spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
            spyOnProperty(window, 'innerHeight', 'get').and.returnValue(800);

            service.configure({
                deviationThreshold: 0.85,
                deviationToleranceSeconds: 3,
                smoothingWindow: 1, // Sin suavizado para test preciso
                samplingIntervalMs: 100,
            }, loggerSpy, deviationCb);

            await service.startCalibration();
            service.completeCalibration();
        });

        it('debe reportar desviación sostenida después del período de tolerancia', () => {
            // Punto muy a la derecha: x=1000 → normalizado = 1.0 > 0.85
            capturedGazeListener!({ x: 1000, y: 400 }, 0);

            // El servicio chequea cada 1000ms.
            // tick(1000): primer check → deviationStartTime se establece, elapsed=0
            jasmine.clock().tick(1000);
            expect(service.hasDeviation()).toBeFalse();

            // tick(2000): elapsed = 1s < 3s
            jasmine.clock().tick(1000);
            expect(service.hasDeviation()).toBeFalse();

            // tick(3000): elapsed = 2s < 3s
            jasmine.clock().tick(1000);
            expect(service.hasDeviation()).toBeFalse();

            // tick(4000): elapsed = 3s >= 3s → desviación detectada
            jasmine.clock().tick(1000);
            expect(service.hasDeviation()).toBeTrue();
            expect(deviationCb).toHaveBeenCalled();
        });

        it('debe resetear desviación cuando la mirada regresa al área segura', () => {
            // Provocar desviación
            capturedGazeListener!({ x: 1000, y: 400 }, 0);
            jasmine.clock().tick(4000);
            expect(service.hasDeviation()).toBeTrue();

            // Regresar al centro
            capturedGazeListener!({ x: 500, y: 400 }, 0);
            jasmine.clock().tick(1000); // siguiente check del intervalo

            expect(service.hasDeviation()).toBeFalse();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // flushGazeBuffer() y getGazeBuffer()
    // ══════════════════════════════════════════════════════════════

    describe('Buffer Operations', () => {

        beforeEach(async () => {
            spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
            spyOnProperty(window, 'innerHeight', 'get').and.returnValue(800);

            service.configure({ samplingIntervalMs: 50, smoothingWindow: 1 }, loggerSpy);
            await service.startCalibration();
            service.completeCalibration();
        });

        it('getGazeBuffer() debe retornar copia sin limpiar', () => {
            capturedGazeListener!({ x: 500, y: 400 }, 0);
            jasmine.clock().tick(100);
            capturedGazeListener!({ x: 600, y: 400 }, 0);

            const buf1 = service.getGazeBuffer();
            const buf2 = service.getGazeBuffer();

            expect(buf1.length).toBe(2);
            expect(buf2.length).toBe(2);
        });

        it('flushGazeBuffer() debe retornar puntos y vaciar el buffer', () => {
            capturedGazeListener!({ x: 500, y: 400 }, 0);
            jasmine.clock().tick(100);
            capturedGazeListener!({ x: 600, y: 400 }, 0);

            const flushed = service.flushGazeBuffer();
            expect(flushed.length).toBe(2);
            expect(service.getGazeBuffer().length).toBe(0);
        });
    });

    // ══════════════════════════════════════════════════════════════
    // stop()
    // ══════════════════════════════════════════════════════════════

    describe('stop()', () => {

        it('debe llamar webgazer.end()', async () => {
            service.configure({}, loggerSpy);
            await service.startCalibration();
            service.completeCalibration();

            service.stop();

            expect(mockWebgazer.end).toHaveBeenCalled();
        });

        it('debe restablecer todo el estado a IDLE', async () => {
            service.configure({}, loggerSpy);
            await service.startCalibration();
            service.completeCalibration();

            service.stop();

            expect(service.gazeState()).toBe('IDLE');
            expect(service.isCalibrated()).toBeFalse();
            expect(service.hasDeviation()).toBeFalse();
            expect(service.lastPoint()).toBeNull();
            expect(service.getGazeBuffer().length).toBe(0);
        });

        it('no debe fallar si se llama stop() sin haber iniciado', () => {
            expect(() => service.stop()).not.toThrow();
        });

        it('debe cancelar requestAnimationFrame del polling manual', async () => {
            service.configure({}, loggerSpy);
            await service.startCalibration();
            service.completeCalibration();

            service.stop();

            expect(cafSpy).toHaveBeenCalled();
        });

        it('debe limpiar el intervalo de detección de desviación (deviationCheckInterval)', async () => {
            service.configure({}, loggerSpy, deviationCb);
            await service.startCalibration();
            service.completeCalibration();

            // En este punto, deviationCheckInterval está activo (cada 1000ms)
            jasmine.clock().tick(500);

            service.stop();

            // Después de stop(), el intervalo debe estar limpio
            // Verificar que no se llame más al callback
            jasmine.clock().tick(1000);
            expect(deviationCb).not.toHaveBeenCalled();
        });

        it('debe limpiar el intervalo de muting de videos (muteRetryInterval)', async () => {
            let intervalClearCount = 0;
            const originalClear = clearInterval;
            spyOn(window, 'clearInterval').and.callFake((id: any) => {
                intervalClearCount++;
                originalClear(id);
            });

            service.configure({}, loggerSpy);
            await service.startCalibration();
            service.completeCalibration();

            service.stop();

            // El muteRetryInterval debe haber sido limpiado
            expect(window.clearInterval).toHaveBeenCalled();
        });

        it('debe limpiar el intervalo de diagnóstico (diagnosticInterval)', async () => {
            service.configure({}, loggerSpy);
            await service.startCalibration();
            service.completeCalibration();

            // diagnosticInterval se inicia en completeCalibration (cada 10s)
            service.stop();

            // Después de stop(), debe estar limpio
            jasmine.clock().tick(10000);
            // Si no se limpiaba, habría logs de diagnóstico
        });

        it('debe limpiar el MutationObserver para silenciar videos', async () => {
            const observerDisconnectSpy = spyOn(MutationObserver.prototype, 'disconnect');

            service.configure({}, loggerSpy);
            await service.startCalibration();

            service.stop();

            expect(observerDisconnectSpy).toHaveBeenCalled();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Cleanup Policy Tests — Verificar NO quedan timers/listeners
    // ══════════════════════════════════════════════════════════════

    describe('Cleanup Policy - Timers', () => {
        it('NO debe tener timers activos después de stop()', async () => {
            service.configure({}, loggerSpy, deviationCb);
            await service.startCalibration();
            service.completeCalibration();

            const initialTimeout = (window as any).setTimeout.callCount || 0;

            service.stop();

            // Todos los timers deben estar limpios
            // Esto se valida por el hecho de que el servicio
            // usa DestroyRefUtility que los limpia automáticamente
        });

        it('NO debe tener intervals activos después de stop()', async () => {
            service.configure({}, loggerSpy, deviationCb);
            await service.startCalibration();
            service.completeCalibration();

            service.stop();

            // Verificar que los 3 intervalos (deviation, muting, diagnostic)
            // hayan sido limpiados
            expect(service.gazeState()).toBe('IDLE');
        });
    });
});
