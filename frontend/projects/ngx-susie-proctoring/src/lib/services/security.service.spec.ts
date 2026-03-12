import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { SecurityService } from './security.service';
import { SecurityViolation } from '../models/contracts';

describe('SecurityService', () => {
    let service: SecurityService;
    let violationCallback: jasmine.Spy<(v: SecurityViolation) => void>;

    // Spies para addEventListener / removeEventListener
    let docAddSpy: jasmine.Spy;
    let docRemoveSpy: jasmine.Spy;
    let winAddSpy: jasmine.Spy;
    let winRemoveSpy: jasmine.Spy;

    // Almacenar handlers registrados para poder dispararlos manualmente
    const docHandlers: Record<string, EventListenerOrEventListenerObject> = {};
    const winHandlers: Record<string, EventListenerOrEventListenerObject> = {};

    beforeEach(() => {
        // Limpiar handlers capturados
        Object.keys(docHandlers).forEach(k => delete docHandlers[k]);
        Object.keys(winHandlers).forEach(k => delete winHandlers[k]);

        // Espiar y capturar listeners
        docAddSpy = spyOn(document, 'addEventListener').and.callFake(
            (type: string, handler: any) => { docHandlers[type] = handler; }
        );
        docRemoveSpy = spyOn(document, 'removeEventListener').and.callThrough();

        winAddSpy = spyOn(window, 'addEventListener').and.callFake(
            (type: string, handler: any) => { winHandlers[type] = handler; }
        );
        winRemoveSpy = spyOn(window, 'removeEventListener').and.callThrough();

        TestBed.configureTestingModule({
            providers: [SecurityService],
        });

        service = TestBed.inject(SecurityService);
        violationCallback = jasmine.createSpy('violationCallback');
    });

    afterEach(() => {
        service.disableProtection();
    });

    // ══════════════════════════════════════════════════════════════
    // 1.2  Listener initialization per policy
    // ══════════════════════════════════════════════════════════════

    describe('enableProtection() — Listener Setup', () => {

        it('debe registrar fullscreenchange cuando requireFullscreen es true', () => {
            service.enableProtection({ requireFullscreen: true }, violationCallback);
            expect(docAddSpy).toHaveBeenCalledWith('fullscreenchange', jasmine.any(Function));
        });

        it('debe registrar visibilitychange y blur cuando preventTabSwitch es true', () => {
            service.enableProtection({ preventTabSwitch: true }, violationCallback);
            expect(docAddSpy).toHaveBeenCalledWith('visibilitychange', jasmine.any(Function));
            expect(winAddSpy).toHaveBeenCalledWith('blur', jasmine.any(Function));
        });

        it('debe registrar popstate cuando preventBackNavigation es true', () => {
            service.enableProtection({ preventBackNavigation: true }, violationCallback);
            expect(winAddSpy).toHaveBeenCalledWith('popstate', jasmine.any(Function));
        });

        it('debe registrar beforeunload cuando preventPageReload es true', () => {
            service.enableProtection({ preventPageReload: true }, violationCallback);
            expect(winAddSpy).toHaveBeenCalledWith('beforeunload', jasmine.any(Function));
        });

        it('debe registrar copy, cut, paste y selectstart cuando preventCopyPaste es true', () => {
            service.enableProtection({ preventCopyPaste: true }, violationCallback);
            expect(docAddSpy).toHaveBeenCalledWith('copy', jasmine.any(Function));
            expect(docAddSpy).toHaveBeenCalledWith('cut', jasmine.any(Function));
            expect(docAddSpy).toHaveBeenCalledWith('paste', jasmine.any(Function));
            expect(docAddSpy).toHaveBeenCalledWith('selectstart', jasmine.any(Function));
        });

        it('NO debe registrar listeners de políticas desactivadas', () => {
            service.enableProtection({}, violationCallback);
            expect(docAddSpy).not.toHaveBeenCalledWith('fullscreenchange', jasmine.any(Function));
            expect(docAddSpy).not.toHaveBeenCalledWith('visibilitychange', jasmine.any(Function));
        });
    });

    // ══════════════════════════════════════════════════════════════
    // 1.3  Violation detection (fullscreen, tab, focus, clipboard)
    // ══════════════════════════════════════════════════════════════

    describe('Violation Detection', () => {

        it('debe reportar FULLSCREEN_EXIT cuando document.fullscreenElement es null', () => {
            service.enableProtection({ requireFullscreen: true }, violationCallback);

            // Simular que fullscreenElement es null (usuario salió de fullscreen)
            Object.defineProperty(document, 'fullscreenElement', {
                value: null,
                writable: true,
                configurable: true,
            });

            const handler = docHandlers['fullscreenchange'] as Function;
            expect(handler).toBeDefined();
            handler();

            expect(violationCallback).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'FULLSCREEN_EXIT' })
            );
        });

        it('debe reportar TAB_SWITCH cuando document.hidden cambia a true', () => {
            service.enableProtection({ preventTabSwitch: true }, violationCallback);

            Object.defineProperty(document, 'hidden', {
                value: true,
                writable: true,
                configurable: true,
            });

            const handler = docHandlers['visibilitychange'] as Function;
            expect(handler).toBeDefined();
            handler();

            expect(violationCallback).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'TAB_SWITCH' })
            );
        });

        it('debe reportar FOCUS_LOST cuando window pierde el foco (blur)', () => {
            service.enableProtection({ preventTabSwitch: true }, violationCallback);

            const handler = winHandlers['blur'] as Function;
            expect(handler).toBeDefined();
            handler();

            expect(violationCallback).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'FOCUS_LOST' })
            );
        });

        it('debe reportar CLIPBOARD_ATTEMPT al copiar', () => {
            service.enableProtection({ preventCopyPaste: true }, violationCallback);

            const handler = docHandlers['copy'] as Function;
            expect(handler).toBeDefined();

            const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') };
            handler(fakeEvent);

            expect(fakeEvent.preventDefault).toHaveBeenCalled();
            expect(violationCallback).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'CLIPBOARD_ATTEMPT' })
            );
        });

        it('debe reportar NAVIGATION_ATTEMPT cuando popstate es disparado', () => {
            service.enableProtection({ preventBackNavigation: true }, violationCallback);

            const handler = winHandlers['popstate'] as Function;
            expect(handler).toBeDefined();
            handler(new PopStateEvent('popstate'));

            expect(violationCallback).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'NAVIGATION_ATTEMPT' })
            );
        });

        it('cada violación debe incluir un timestamp ISO', () => {
            service.enableProtection({ preventTabSwitch: true }, violationCallback);

            const handler = winHandlers['blur'] as Function;
            handler();

            const call = violationCallback.calls.mostRecent().args[0];
            expect(call.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 prefix
        });
    });

    // ══════════════════════════════════════════════════════════════
    // 1.4  DevTools polling detection
    // ══════════════════════════════════════════════════════════════

    describe('DevTools Detection (Polling)', () => {
        beforeEach(() => {
            try { jasmine.clock().uninstall(); } catch (_) { /* not installed */ }
            jasmine.clock().install();
        });

        afterEach(() => {
            try { jasmine.clock().uninstall(); } catch (_) { /* ignore */ }
        });

        it('debe reportar INSPECTION_ATTEMPT cuando outerWidth − innerWidth > 160', () => {
            // Guardar originales
            const originalOuterWidth = window.outerWidth;
            const originalInnerWidth = window.innerWidth;

            // Simular DevTools abierto (diferencia mayor a 160px)
            spyOnProperty(window, 'outerWidth', 'get').and.returnValue(1600);
            spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1200); // diff = 400

            service.enableProtection({ preventInspection: true }, violationCallback);

            // Adelantar el reloj para que se ejecute el intervalo (polling cambió de 2s a 5s)
            jasmine.clock().tick(5100);

            expect(violationCallback).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'INSPECTION_ATTEMPT' })
            );
        });

        it('NO debe reportar INSPECTION_ATTEMPT cuando la diferencia es <= 160', () => {
            spyOnProperty(window, 'outerWidth', 'get').and.returnValue(1400);
            spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1380); // diff = 20

            spyOnProperty(window, 'outerHeight', 'get').and.returnValue(900);
            spyOnProperty(window, 'innerHeight', 'get').and.returnValue(880); // diff = 20

            service.enableProtection({ preventInspection: true }, violationCallback);

            jasmine.clock().tick(5100);

            expect(violationCallback).not.toHaveBeenCalled();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // 1.5  Teardown — disableProtection()
    // ══════════════════════════════════════════════════════════════

    describe('disableProtection() — Teardown', () => {

        it('debe remover todos los listeners del document', () => {
            service.enableProtection({
                requireFullscreen: true,
                preventCopyPaste: true,
            }, violationCallback);

            service.disableProtection();

            expect(docRemoveSpy).toHaveBeenCalledWith('fullscreenchange', jasmine.any(Function));
            expect(docRemoveSpy).toHaveBeenCalledWith('visibilitychange', jasmine.any(Function));
            expect(docRemoveSpy).toHaveBeenCalledWith('copy', jasmine.any(Function));
            expect(docRemoveSpy).toHaveBeenCalledWith('cut', jasmine.any(Function));
            expect(docRemoveSpy).toHaveBeenCalledWith('paste', jasmine.any(Function));
            expect(docRemoveSpy).toHaveBeenCalledWith('selectstart', jasmine.any(Function));
        });

        it('debe remover todos los listeners de window', () => {
            service.enableProtection({
                preventTabSwitch: true,
                preventBackNavigation: true,
                preventPageReload: true,
            }, violationCallback);

            service.disableProtection();

            expect(winRemoveSpy).toHaveBeenCalledWith('blur', jasmine.any(Function));
            expect(winRemoveSpy).toHaveBeenCalledWith('popstate', jasmine.any(Function));
            expect(winRemoveSpy).toHaveBeenCalledWith('beforeunload', jasmine.any(Function));
        });

        it('debe limpiar el intervalo de detección de DevTools', () => {
            jasmine.clock().install();

            const clearIntervalSpy = spyOn(globalThis, 'clearInterval').and.callThrough();

            service.enableProtection({ preventInspection: true }, violationCallback);
            service.disableProtection();

            expect(clearIntervalSpy).toHaveBeenCalled();

            jasmine.clock().uninstall();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Cleanup Policy Tests — Verificar NO quedan timers/listeners
    // ══════════════════════════════════════════════════════════════

    describe('Cleanup Policy - Event Listeners', () => {
        it('NO debe haber event listeners después de disableProtection()', () => {
            service.enableProtection({
                requireFullscreen: true,
                preventTabSwitch: true,
                preventInspection: true,
                preventBackNavigation: true,
                preventPageReload: true,
                preventCopyPaste: true,
            }, violationCallback);

            service.disableProtection();

            // Verificar que todos los listeners fueron removidos
            expect(docRemoveSpy).toHaveBeenCalledWith('fullscreenchange', jasmine.any(Function));
            expect(winRemoveSpy).toHaveBeenCalledWith('blur', jasmine.any(Function));
        });

        it('NO debe haber timers/intervals después de disableProtection()', () => {
            jasmine.clock().install();

            service.enableProtection({ preventInspection: true }, violationCallback);

            const clearIntervalSpy = spyOn(globalThis, 'clearInterval').and.callThrough();
            service.disableProtection();

            // El intervalo debe haberse limpiado
            expect(clearIntervalSpy).toHaveBeenCalled();

            jasmine.clock().uninstall();
        });
    });
});
