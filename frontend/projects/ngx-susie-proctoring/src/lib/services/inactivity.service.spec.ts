import { TestBed } from '@angular/core/testing';
import { InactivityService } from './inactivity.service';

describe('InactivityService', () => {
    let service: InactivityService;

    // Spies para window addEventListener / removeEventListener
    let winAddSpy: jasmine.Spy;
    let winRemoveSpy: jasmine.Spy;

    // Almacenar handlers registrados
    const winHandlers: Record<string, EventListenerOrEventListenerObject> = {};

    beforeEach(() => {
        // Asegurar estado limpio del clock
        try { jasmine.clock().uninstall(); } catch (_) { /* no estaba instalado */ }
        jasmine.clock().install();
        jasmine.clock().mockDate(new Date(2026, 2, 10, 12, 0, 0));

        Object.keys(winHandlers).forEach(k => delete winHandlers[k]);

        winAddSpy = spyOn(window, 'addEventListener').and.callFake(
            (type: string, handler: any, _opts?: any) => { winHandlers[type] = handler; }
        );
        winRemoveSpy = spyOn(window, 'removeEventListener').and.callThrough();

        TestBed.configureTestingModule({
            providers: [InactivityService],
        });

        service = TestBed.inject(InactivityService);
    });

    afterEach(() => {
        try { service?.stopMonitoring(); } catch (_) { /* ignore */ }
        try { jasmine.clock().uninstall(); } catch (_) { /* ignore */ }
    });

    // ══════════════════════════════════════════════════════════════
    // configure()
    // ══════════════════════════════════════════════════════════════

    describe('configure()', () => {

        it('debe establecer el límite de inactividad en milisegundos a partir de minutos', () => {
            service.configure(5);
            // Verificamos indirectamente: si el warning se muestra al 90% de 5 min (270s)
            service.startMonitoring();
            // Avanzar 269 segundos — aún no debe mostrar warning
            jasmine.clock().tick(269_000);
            jasmine.clock().tick(5_000); // trigger the interval check
            expect(service.showWarning()).toBeFalse();

            // Avanzar hasta superar 90% de 300s = 270s
            jasmine.clock().tick(5_000); // total ~ 279s
            expect(service.showWarning()).toBeTrue();
        });

        it('no debe cambiar el límite si se pasa 0 o negativo', () => {
            service.configure(0);
            service.startMonitoring();
            // Default = 3 min = 180s, 90% = 162s
            // A 155s aún no debe haber warning
            jasmine.clock().tick(155_000);
            jasmine.clock().tick(5_000); // interval check a 160s, 160 < 162
            expect(service.showWarning()).toBeFalse();

            // A 165s ya debe haber warning (162s < 165s)
            jasmine.clock().tick(5_000); // 165s
            expect(service.showWarning()).toBeTrue();
        });

        it('debe almacenar el callback de inactividad', () => {
            const callback = jasmine.createSpy('inactivityCallback');
            service.configure(1, callback); // 1 minuto = 60s
            service.startMonitoring();

            // Avanzar más de 60 segundos
            jasmine.clock().tick(65_000);

            expect(callback).toHaveBeenCalled();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // startMonitoring()
    // ══════════════════════════════════════════════════════════════

    describe('startMonitoring()', () => {

        it('debe registrar listeners para mousemove, keydown, click, scroll', () => {
            service.startMonitoring();

            expect(winAddSpy).toHaveBeenCalledWith('mousemove', jasmine.any(Function), jasmine.objectContaining({ passive: true }));
            expect(winAddSpy).toHaveBeenCalledWith('keydown', jasmine.any(Function), jasmine.objectContaining({ passive: true }));
            expect(winAddSpy).toHaveBeenCalledWith('click', jasmine.any(Function), jasmine.objectContaining({ passive: true }));
            expect(winAddSpy).toHaveBeenCalledWith('scroll', jasmine.any(Function), jasmine.objectContaining({ passive: true }));
        });

        it('debe llamar stopMonitoring() primero si ya estaba corriendo', () => {
            const stopSpy = spyOn(service, 'stopMonitoring').and.callThrough();
            service.startMonitoring();
            service.startMonitoring(); // segunda vez
            expect(stopSpy).toHaveBeenCalledTimes(2); // startMonitoring llama stop al inicio
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Warning (90%) y Timeout (100%)
    // ══════════════════════════════════════════════════════════════

    describe('Warning y Timeout', () => {

        it('debe activar showWarning al pasar el 90% del límite de inactividad', () => {
            service.configure(3); // 3 min = 180s, 90% = 162s
            service.startMonitoring();

            expect(service.showWarning()).toBeFalse();

            // Avanzar 160s — debajo del 90%
            jasmine.clock().tick(160_000);
            jasmine.clock().tick(5_000); // interval check a los 165s > 162s
            expect(service.showWarning()).toBeTrue();
        });

        it('debe ejecutar el callback al llegar al 100% del límite', () => {
            const callback = jasmine.createSpy('timeoutCb');
            service.configure(3, callback); // 180s
            service.startMonitoring();

            // Avanzar 185s
            jasmine.clock().tick(185_000);

            expect(callback).toHaveBeenCalled();
        });

        it('debe resetear el timer después del timeout para evitar llamadas múltiples', () => {
            const callback = jasmine.createSpy('timeoutCb');
            service.configure(3, callback);
            service.startMonitoring();

            // Primer timeout
            jasmine.clock().tick(185_000);
            expect(callback).toHaveBeenCalledTimes(1);

            // No debe volver a disparar inmediatamente en el siguiente tick
            jasmine.clock().tick(5_000);
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    // ══════════════════════════════════════════════════════════════
    // handleUserActivity
    // ══════════════════════════════════════════════════════════════

    describe('handleUserActivity (interacción del usuario)', () => {

        it('debe resetear el timer cuando el usuario interactúa y no hay warning', () => {
            service.configure(3); // 180s
            service.startMonitoring();

            // Avanzar 100s
            jasmine.clock().tick(100_000);

            // Simular actividad del usuario
            const handler = winHandlers['mousemove'] as Function;
            expect(handler).toBeDefined();
            handler();

            // Avanzar otros 100s (total desde reset: 100s, no debe haber warning)
            jasmine.clock().tick(100_000);
            // 100s < 162s (90% de 180s) — no warning
            expect(service.showWarning()).toBeFalse();
        });

        it('NO debe resetear si showWarning es true (usuario debe confirmar explícitamente)', () => {
            service.configure(3); // 180s
            service.startMonitoring();

            // Forzar warning
            jasmine.clock().tick(165_000); // > 162s

            expect(service.showWarning()).toBeTrue();

            // Simular actividad — NO debe resetear (showWarning sigue true)
            const handler = winHandlers['mousemove'] as Function;
            handler();

            // El warning debe seguir activo
            expect(service.showWarning()).toBeTrue();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // resetTimer()
    // ══════════════════════════════════════════════════════════════

    describe('resetTimer()', () => {

        it('debe ocultar el warning y resetear lastActivity', () => {
            service.configure(3);
            service.startMonitoring();

            // Forzar warning
            jasmine.clock().tick(165_000);
            expect(service.showWarning()).toBeTrue();

            // Reset explícito
            service.resetTimer();
            expect(service.showWarning()).toBeFalse();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // stopMonitoring() y ngOnDestroy()
    // ══════════════════════════════════════════════════════════════

    describe('stopMonitoring()', () => {

        it('debe remover todos los listeners de window', () => {
            service.startMonitoring();
            service.stopMonitoring();

            expect(winRemoveSpy).toHaveBeenCalledWith('mousemove', jasmine.any(Function));
            expect(winRemoveSpy).toHaveBeenCalledWith('keydown', jasmine.any(Function));
            expect(winRemoveSpy).toHaveBeenCalledWith('click', jasmine.any(Function));
            expect(winRemoveSpy).toHaveBeenCalledWith('scroll', jasmine.any(Function));
        });

        it('debe resetear showWarning a false', () => {
            service.configure(3);
            service.startMonitoring();
            jasmine.clock().tick(165_000);
            expect(service.showWarning()).toBeTrue();

            service.stopMonitoring();
            expect(service.showWarning()).toBeFalse();
        });
    });

    describe('ngOnDestroy()', () => {

        it('debe llamar stopMonitoring al destruirse', () => {
            const stopSpy = spyOn(service, 'stopMonitoring');
            service.ngOnDestroy();
            expect(stopSpy).toHaveBeenCalled();
        });
    });
});
