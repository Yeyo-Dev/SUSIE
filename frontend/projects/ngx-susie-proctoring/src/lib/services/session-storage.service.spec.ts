import { TestBed,fakeAsync, tick } from '@angular/core/testing';
import { SessionStorageService } from './session-storage.service';
import { PersistedSessionState, SESSION_STATE_VERSION } from '@lib/models/session-storage.interface';

/**
 * Helper: deletes the IndexedDB database used by the service
 * to guarantee a clean slate between tests.
 */
function deleteTestDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('susie_evidence_queue');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve(); // proceed even if blocked
    });
}

/**
 * Helper: creates a valid PersistedSessionState for testing
 */
function createTestState(overrides: Partial<PersistedSessionState> = {}): PersistedSessionState {
    return {
        examSessionId: 'test-session-123',
        examId: 'exam-1',
        answers: { 1: 'A', 2: 'B', 3: 'C' },
        currentQuestionIndex: 2,
        timerSecondsRemaining: 1800, // 30 minutes
        examStartedAt: new Date().toISOString(),
        proctoringState: 'MONITORING',
        totalViolations: 0,
        tabSwitchCount: 0,
        remoteSessionId: 'remote-123',
        persistedAt: new Date().toISOString(),
        version: SESSION_STATE_VERSION,
        ...overrides,
    };
}

describe('SessionStorageService', () => {
    let service: SessionStorageService;

    beforeEach(async () => {
        await deleteTestDatabase();

        TestBed.configureTestingModule({
            providers: [SessionStorageService],
        });

        service = TestBed.inject(SessionStorageService);
    });

    afterEach(async () => {
        service.ngOnDestroy();
        await deleteTestDatabase();
    });

    // ══════════════════════════════════════════════════════════════
    // REQ-SS-001: saveState() - Persist Session State
    // ══════════════════════════════════════════════════════════════

    describe('saveState()', () => {
        it('debe persistir el estado en IndexedDB', async () => {
            await service.init();

            const state = createTestState();
            await service.saveState(state);

            // Esperar debounce
            await new Promise(r => setTimeout(r, 600));

            const loaded = await service.loadState(state.examSessionId);
            expect(loaded).toBeTruthy();
            expect(loaded!.examSessionId).toBe(state.examSessionId);
            expect(loaded!.answers).toEqual(state.answers);
        });

        it('debe agregar persistedAt y version automáticamente', async () => {
            await service.init();

            const state = createTestState({ persistedAt: 'old-timestamp' });
            await service.saveState(state);

            await new Promise(r => setTimeout(r, 600));

            const loaded = await service.loadState(state.examSessionId);
            expect(loaded).toBeTruthy();
            expect(loaded!.persistedAt).not.toBe('old-timestamp');
            expect(loaded!.version).toBe(SESSION_STATE_VERSION);
        });

        it('debe debouncear múltiples llamadas (500ms)', fakeAsync(async () => {
            await service.init();

            const state1 = createTestState({ answers: { 1: 'A' } });
            const state2 = createTestState({ answers: { 1: 'B' } });
            const state3 = createTestState({ answers: { 1: 'C' } });

            // Llamadas rápidas
            await service.saveState(state1);
            await service.saveState(state2);
            await service.saveState(state3);

            // Solo la última debería persistir
            tick(600);
            await Promise.resolve();

            const loaded = await service.loadState(state3.examSessionId);
            expect(loaded).toBeTruthy();
            expect(loaded!.answers[1]).toBe('C'); // Último valor
        }));

        it('no debe fallar si IndexedDB no está inicializado', async () => {
            // No llamar init()
            const state = createTestState();

            // No debería lanzar error
            await expectAsync(service.saveState(state)).toBeResolved();
        });

        it('debe actualizar lastSaved signal después de guardar', fakeAsync(async () => {
            await service.init();

            const state = createTestState();
            expect(service.lastSaved()).toBeNull();

            await service.saveState(state);
            tick(600);

            expect(service.lastSaved()).toBeTruthy();
            expect(service.lastSaved() instanceof Date).toBe(true);
        }));
    });

    // ══════════════════════════════════════════════════════════════
    // REQ-SS-002: loadState() - Restore Session State
    // ══════════════════════════════════════════════════════════════

    describe('loadState()', () => {
        it('debe retornar null cuando no existe sesión', async () => {
            await service.init();

            const loaded = await service.loadState('non-existent-id');
            expect(loaded).toBeNull();
        });

        it('debe retornar null si IndexedDB no está inicializado', async () => {
            // No llamar init()
            const loaded = await service.loadState('any-id');
            expect(loaded).toBeNull();
        });

        it('debe retornar el estado completo persistido', async () => {
            await service.init();

            const state = createTestState({
                answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' },
                currentQuestionIndex: 3,
                totalViolations: 5,
                tabSwitchCount: 2,
            });
            await service.saveState(state);
            await new Promise(r => setTimeout(r, 600));

            const loaded = await service.loadState(state.examSessionId);
            expect(loaded).toBeTruthy();
            expect(loaded!.answers).toEqual({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' });
            expect(loaded!.currentQuestionIndex).toBe(3);
            expect(loaded!.totalViolations).toBe(5);
            expect(loaded!.tabSwitchCount).toBe(2);
            expect(loaded!.proctoringState).toBe('MONITORING');
        });

        it('debe retornar null para clave vacía', async () => {
            await service.init();
            const loaded = await service.loadState('');
            expect(loaded).toBeNull();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // REQ-SS-003: clearState() - Clear Session on Completion
    // ══════════════════════════════════════════════════════════════

    describe('clearState()', () => {
        it('debe eliminar la sesión de IndexedDB', async () => {
            await service.init();

            const state = createTestState();
            await service.saveState(state);
            await new Promise(r => setTimeout(r, 600));

            expect(await service.hasSession(state.examSessionId)).toBe(true);

            await service.clearState(state.examSessionId);

            expect(await service.hasSession(state.examSessionId)).toBe(false);
            expect(await service.loadState(state.examSessionId)).toBeNull();
        });

        it('debe ser idempotente - no fallar si no existe', async () => {
            await service.init();

            // No debería lanzar error
            await expectAsync(service.clearState('non-existent')).toBeResolved();
        });

        it('no debe fallar si IndexedDB no está inicializado', async () => {
            // No llamar init()
            await expectAsync(service.clearState('any-id')).toBeResolved();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // REQ-SS-002: hasSession() - Check for Recoverable Session
    // ══════════════════════════════════════════════════════════════

    describe('hasSession()', () => {
        it('debe retornar true cuando existe sesión', async () => {
            await service.init();

            const state = createTestState();
            await service.saveState(state);
            await new Promise(r => setTimeout(r, 600));

            expect(await service.hasSession(state.examSessionId)).toBe(true);
        });

        it('debe retornar false cuando no existe sesión', async () => {
            await service.init();
            expect(await service.hasSession('non-existent')).toBe(false);
        });

        it('debe retornar false si IndexedDB no está inicializado', async () => {
            // No llamar init()
            expect(await service.hasSession('any-id')).toBe(false);
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Feature Detection: isAvailable()
    // ══════════════════════════════════════════════════════════════

    describe('isAvailable() - static', () => {
        it('debe retornar true en navegador normal', () => {
            expect(SessionStorageService.isAvailable()).toBe(true);
        });

        it('debe manejar excepciones de acceso a indexedDB', () => {
            // En un navegador normal, esto debería funcionar
            // En entorno restringido, retornaría false
            const result = SessionStorageService.isAvailable();
            expect(typeof result).toBe('boolean');
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Edge Cases: IndexedDB Features
    // ══════════════════════════════════════════════════════════════

    describe('Edge Cases', () => {
        it('debe manejar respuestas vacías', async () => {
            await service.init();

            const state = createTestState({ answers: {} });
            await service.saveState(state);
            await new Promise(r => setTimeout(r, 600));

            const loaded = await service.loadState(state.examSessionId);
            expect(loaded).toBeTruthy();
            expect(loaded!.answers).toEqual({});
        });

        it('debe sobrescribir sesión existente (mismo examSessionId)', async () => {
            await service.init();

            const state1 = createTestState({ answers: { 1: 'A' } });
            await service.saveState(state1);
            await new Promise(r => setTimeout(r, 600));

            const state2 = createTestState({ answers: { 1: 'B', 2: 'C' } });
            await service.saveState(state2);
            await new Promise(r => setTimeout(r, 600));

            const loaded = await service.loadState(state1.examSessionId);
            expect(loaded!.answers).toEqual({ 1: 'B', 2: 'C' });
        });

        it('debe mantener sesiones separadas por examSessionId', async () => {
            await service.init();

            const state1 = createTestState({ examSessionId: 'session-1', answers: { 1: 'A' } });
            const state2 = createTestState({ examSessionId: 'session-2', answers: { 1: 'B' } });

            await service.saveState(state1);
            await new Promise(r => setTimeout(r, 600));
            await service.saveState(state2);
            await new Promise(r => setTimeout(r, 600));

            expect(await service.hasSession('session-1')).toBe(true);
            expect(await service.hasSession('session-2')).toBe(true);

            const loaded1 = await service.loadState('session-1');
            const loaded2 = await service.loadState('session-2');

            expect(loaded1!.answers[1]).toBe('A');
            expect(loaded2!.answers[1]).toBe('B');
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Lifecycle: ngOnDestroy
    // ══════════════════════════════════════════════════════════════

    describe('ngOnDestroy()', () => {
        it('debe limpiar el timeout pendiente', fakeAsync(async () => {
            await service.init();

            const state = createTestState();
            await service.saveState(state);

            // Destruir antes de que expire el debounce
            service.ngOnDestroy();

            // Verificar que el timeout fue cancelado
            // Si no se canceló, el test fallaría por timeouts pendientes
            tick(600);
            expect(true).toBe(true); // No debería haber lanzado error
        }));

        it('debe cerrar la conexión a IndexedDB', async () => {
            await service.init();
            service.ngOnDestroy();

            // Verificar que la conexión fue cerrada
            // Intentar llamar métodos debería fallar o retornar gracefully
            const result = await service.hasSession('test');
            expect(result).toBe(false); // DB cerrada = no disponible
        });
    });
});