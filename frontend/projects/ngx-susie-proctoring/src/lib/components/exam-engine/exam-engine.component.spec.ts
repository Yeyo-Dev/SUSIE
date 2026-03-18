import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks, flush } from '@angular/core/testing';
import { ExamEngineComponent } from './exam-engine.component';
import { SusieConfig, SusieQuestion, ExamResult } from '@lib/models/contracts';

// ── Helpers ──

function buildConfig(durationMinutes = 10): SusieConfig {
    return {
        sessionContext: {
            examSessionId: 'sess-1',
            examId: 'ex-1',
            examTitle: 'Test Exam',
            durationMinutes,
        },
        securityPolicies: {
            requireCamera: false,
            requireMicrophone: false,
            requireFullscreen: true,
        },
        apiUrl: 'http://localhost',
        authToken: 'tok',
    };
}

function buildQuestions(count = 3): SusieQuestion[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        content: `Pregunta ${i + 1}`,
        options: ['A', 'B', 'C', 'D'],
    }));
}

describe('ExamEngineComponent', () => {
    let component: ExamEngineComponent;
    let fixture: ComponentFixture<ExamEngineComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ExamEngineComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ExamEngineComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        // Siempre intentar detener el timer real si quedó activo
        try { (component as any).stopTimer(); } catch (_) { /* noop */ }
    });

    // ═══════════════════════════════════════════════════
    // 3.3 — Configuración inicial del temporizador
    // ═══════════════════════════════════════════════════

    describe('Temporizador', () => {
        it('debe iniciar el timer automáticamente basándose en durationMinutes', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(5));
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            expect(component.timerSeconds()).toBe(5 * 60);
            discardPeriodicTasks();
        }));

        it('debe decrementar el timer cada segundo', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(1));
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            const initial = component.timerSeconds();
            tick(3000);
            expect(component.timerSeconds()).toBe(initial - 3);
            discardPeriodicTasks();
        }));

        it('debe formatear el tiempo como MM:SS', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(2));
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            expect(component.timerFormatted()).toBe('02:00');
            tick(61000);
            expect(component.timerFormatted()).toBe('00:59');
            discardPeriodicTasks();
        }));
    });

    // ═══════════════════════════════════════════════════
    // 3.4 — Toasts de advertencia
    // ═══════════════════════════════════════════════════

    describe('Toasts de advertencia', () => {
        it('debe mostrar toast a los 5 minutos restantes', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10)); // 600s
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            // Avanzar hasta que queden exactamente 300s (5 min)
            tick((600 - 300) * 1000);
            expect(component.toast()).toBeTruthy();
            expect(component.toast()!.message).toContain('5 minutos');
            discardPeriodicTasks();
            flush(); // limpiar setTimeout de dismissToast
        }));

        it('debe mostrar toast crítico a 1 minuto restante', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(2)); // 120s
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            tick((120 - 60) * 1000);
            expect(component.toast()).toBeTruthy();
            expect(component.toast()!.type).toBe('critical');
            discardPeriodicTasks();
        }));

        it('debe mostrar toast a 10 segundos restantes', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(1)); // 60s
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            tick((60 - 10) * 1000);
            expect(component.toast()).toBeTruthy();
            expect(component.toast()!.message).toContain('10 segundos');
            discardPeriodicTasks();
        }));
    });

    // ═══════════════════════════════════════════════════
    // 3.5 — Auto-submit
    // ═══════════════════════════════════════════════════

    describe('Auto-submit', () => {
        it('debe emitir examFinished cuando el timer llega a 0', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(1)); // 60s
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            let result: ExamResult | undefined;
            component.examFinished.subscribe((r: ExamResult) => result = r);

            tick(61000);
            expect(result).toBeTruthy();
            expect(result!.completedAt).toBeTruthy();
            discardPeriodicTasks();
        }));
    });

    // ═══════════════════════════════════════════════════
    // 3.6 — Navegación de preguntas y respuestas
    // ═══════════════════════════════════════════════════

    describe('Navegación y respuestas', () => {
        it('debe iniciar en el índice 0', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions(5));
            fixture.detectChanges();

            expect(component.currentIndex()).toBe(0);
            discardPeriodicTasks();
        }));

        it('nextQuestion debe avanzar el índice', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions(5));
            fixture.detectChanges();

            component.nextQuestion();
            expect(component.currentIndex()).toBe(1);
            discardPeriodicTasks();
        }));

        it('prevQuestion debe retroceder el índice', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions(5));
            fixture.detectChanges();

            component.nextQuestion();
            component.nextQuestion();
            component.prevQuestion();
            expect(component.currentIndex()).toBe(1);
            discardPeriodicTasks();
        }));

        it('prevQuestion no debe bajar de 0', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions(5));
            fixture.detectChanges();

            component.prevQuestion();
            expect(component.currentIndex()).toBe(0);
            discardPeriodicTasks();
        }));

        it('nextQuestion no debe superar la última pregunta', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions(5));
            fixture.detectChanges();

            for (let i = 0; i < 10; i++) component.nextQuestion();
            expect(component.currentIndex()).toBe(4);
            discardPeriodicTasks();
        }));

        it('selectAnswer debe guardar la respuesta', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions(5));
            fixture.detectChanges();

            component.selectAnswer(1, 'B');
            expect(component.answers()[1]).toBe('B');
            discardPeriodicTasks();
        }));

        it('answeredCount debe reflejar la cantidad de respuestas', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions(5));
            fixture.detectChanges();

            component.selectAnswer(1, 'A');
            component.selectAnswer(3, 'C');
            expect(component.answeredCount()).toBe(2);
            discardPeriodicTasks();
        }));

        it('progressPercent debe calcularse sobre el total de preguntas', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions(5));
            fixture.detectChanges();

            expect(component.progressPercent()).toBe(20);
            component.nextQuestion();
            expect(component.progressPercent()).toBe(40);
            discardPeriodicTasks();
        }));
    });

    // ═══════════════════════════════════════════════════
    // 3.7 — Submit manual
    // ═══════════════════════════════════════════════════

    describe('Submit manual', () => {
        it('submitExam debe abrir el modal de confirmación', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            component.submitExam();
            expect(component.showConfirmModal()).toBeTrue();
            discardPeriodicTasks();
        }));

        it('cancelSubmit debe cerrar el modal', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            component.submitExam();
            component.cancelSubmit();
            expect(component.showConfirmModal()).toBeFalse();
            discardPeriodicTasks();
        }));

        it('confirmSubmit debe emitir examFinished', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            let result: ExamResult | undefined;
            component.examFinished.subscribe((r: ExamResult) => result = r);

            component.selectAnswer(1, 'A');
            component.confirmSubmit();

            expect(result).toBeTruthy();
            expect(result!.answers[1]).toBe('A');
            // confirmSubmit llama finish() que detiene el timer
        }));

        it('dismissToast debe limpiar el toast activo', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig(10));
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            component.toast.set({ message: 'test', type: 'info' });
            component.dismissToast();
            expect(component.toast()).toBeNull();
            discardPeriodicTasks();
        }));
    });

    // ═══════════════════════════════════════════════════
    // REQ-EE-002: Session Recovery — restoreState()
    // ═══════════════════════════════════════════════════

    describe('Session Recovery — restoreState()', () => {
        it('debe restaurar respuestas desde estado persistido', fakeAsync(() => {
            const config = buildConfig(30);
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions(20));
            fixture.detectChanges();

            // Simular estado persistido
            const persistedState = {
                examSessionId: 'sess-1',
                examId: 'ex-1',
                answers: { 1: 'A', 2: 'B', 3: 'C', 5: 'D', 10: 'A' },
                currentQuestionIndex: 10,
                timerSecondsRemaining: 1200,
                examStartedAt: new Date(Date.now() - 600000).toISOString(), // started 10min ago
                proctoringState: 'MONITORING' as const,
                totalViolations: 2,
                tabSwitchCount: 1,
                remoteSessionId: 'remote-123',
                persistedAt: new Date().toISOString(),
                version: 1,
            };

            component.restoreState(persistedState, 30);
            tick();

            // Verificar respuestas restauradas
            expect(component.answers()).toEqual({ 1: 'A', 2: 'B', 3: 'C', 5: 'D', 10: 'A' });
            expect(component.answeredCount()).toBe(5);

            // Verificar índice restaurado
            expect(component.currentIndex()).toBe(10);
            discardPeriodicTasks();
        }));

        it('debe restaurar el índice de pregunta actual', fakeAsync(() => {
            const config = buildConfig(30);
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions(20));
            fixture.detectChanges();

            const persistedState = {
                examSessionId: 'sess-1',
                examId: 'ex-1',
                answers: { 1: 'A' },
                currentQuestionIndex: 15,
                timerSecondsRemaining: 900,
                examStartedAt: new Date(Date.now() - 900000).toISOString(),
                proctoringState: 'MONITORING' as const,
                totalViolations: 0,
                tabSwitchCount: 0,
                remoteSessionId: null,
                persistedAt: new Date().toISOString(),
                version: 1,
            };

            component.restoreState(persistedState, 30);
            tick();

            expect(component.currentIndex()).toBe(15);
            discardPeriodicTasks();
        }));

        it('debe restaurar el timestamp de inicio (startedAt)', fakeAsync(() => {
            const config = buildConfig(30);
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            const startedAt = new Date(Date.now() - 600000).toISOString(); // 10min ago
            const persistedState = {
                examSessionId: 'sess-1',
                examId: 'ex-1',
                answers: { 1: 'A' },
                currentQuestionIndex: 0,
                timerSecondsRemaining: 1200,
                examStartedAt: startedAt,
                proctoringState: 'MONITORING' as const,
                totalViolations: 0,
                tabSwitchCount: 0,
                remoteSessionId: null,
                persistedAt: new Date().toISOString(),
                version: 1,
            };

            component.restoreState(persistedState, 30);
            tick();

            expect(component.startedAt()).toBe(startedAt);
            discardPeriodicTasks();
        }));

        it('debe calcular el tiempo restante basándose en elapsed time', fakeAsync(() => {
            const config = buildConfig(30); // 30 min exam
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            // Examen iniciado hace 10 minutos (600 segundos)
            const startedAt = new Date(Date.now() - 600000).toISOString();
            const persistedState = {
                examSessionId: 'sess-1',
                examId: 'ex-1',
                answers: { 1: 'A' },
                currentQuestionIndex: 0,
                timerSecondsRemaining: 1200, // Stale value
                examStartedAt: startedAt,
                proctoringState: 'MONITORING' as const,
                totalViolations: 0,
                tabSwitchCount: 0,
                remoteSessionId: null,
                persistedAt: new Date().toISOString(),
                version: 1,
            };

            component.restoreState(persistedState, 30);
            tick();

            // 30 min *60 = 1800 sec total
            // - 10 min elapsed = 600 sec
            // = 1200 sec remaining (20 min)
            expect(component.timerSeconds()).toBe(1800 - 600);
            discardPeriodicTasks();
        }));
    });

    // ═══════════════════════════════════════════════════
    // REQ-EE-003: Timer Continuation after Recovery
    // ═══════════════════════════════════════════════════

    describe('Timer Continuation after Recovery', () => {
        it('debe continuar el timer desde el tiempo calculado', fakeAsync(() => {
            const config = buildConfig(10); // 10 min exam
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            // Examen iniciado hace 5 minutos
            const startedAt = new Date(Date.now() - 300000).toISOString();
            const persistedState = {
                examSessionId: 'sess-1',
                examId: 'ex-1',
                answers: { 1: 'A' },
                currentQuestionIndex: 0,
                timerSecondsRemaining: 300, // Stale
                examStartedAt: startedAt,
                proctoringState: 'MONITORING' as const,
                totalViolations: 0,
                tabSwitchCount: 0,
                remoteSessionId: null,
                persistedAt: new Date().toISOString(),
                version: 1,
            };

            component.restoreState(persistedState, 10);
            tick();

            // 10min * 60 = 600sec, - 5min elapsed = 300sec remaining
            expect(component.timerSeconds()).toBe(300);

            // Verificar que el timer decrementa
            tick(3000);
            expect(component.timerSeconds()).toBe(297);
            discardPeriodicTasks();
        }));

        it('debe emitir autoSubmit si el tiempo ya expiró durante recovery', fakeAsync(() => {
            const config = buildConfig(10); // 10 min exam
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            // Examen iniciado hace 15 minutos (ya expiró)
            const startedAt = new Date(Date.now() - 900000).toISOString(); // 15min ago
            const persistedState = {
                examSessionId: 'sess-1',
                examId: 'ex-1',
                answers: { 1: 'A', 2: 'B' },
                currentQuestionIndex: 5,
                timerSecondsRemaining: 0,
                examStartedAt: startedAt,
                proctoringState: 'MONITORING' as const,
                totalViolations: 0,
                tabSwitchCount: 0,
                remoteSessionId: null,
                persistedAt: new Date().toISOString(),
                version: 1,
            };

            let result: ExamResult | undefined;
            component.examFinished.subscribe((r: ExamResult) => result = r);

            component.restoreState(persistedState, 10);
            tick();

            // El timer debe ser 0 y autoSubmit disparado
            expect(component.timerSeconds()).toBe(0);
            expect(result).toBeTruthy();
            expect(result!.answers).toEqual({ 1: 'A', 2: 'B' });
            discardPeriodicTasks();
        }));

        it('debe restaurar timer con 1 segundo restante y emitir autoSubmit', fakeAsync(() => {
            const config = buildConfig(10); // 10 min exam
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            // Examen iniciado hace 599 segundos (1 sec remaining)
            const startedAt = new Date(Date.now() - 599000).toISOString();
            const persistedState = {
                examSessionId: 'sess-1',
                examId: 'ex-1',
                answers: { 1: 'C' },
                currentQuestionIndex: 0,
                timerSecondsRemaining: 1,
                examStartedAt: startedAt,
                proctoringState: 'MONITORING' as const,
                totalViolations: 0,
                tabSwitchCount: 0,
                remoteSessionId: null,
                persistedAt: new Date().toISOString(),
                version: 1,
            };

            let result: ExamResult | undefined;
            component.examFinished.subscribe((r: ExamResult) => result = r);

            component.restoreState(persistedState, 10);
            tick();

            // Debe tener 1 segundo restante (aprox)
            expect(component.timerSeconds()).toBeLessThanOrEqual(2);

            // Avanzar 2 segundos para que expire
            tick(2000);

            expect(result).toBeTruthy();
            discardPeriodicTasks();
        }));
    });

    // ═══════════════════════════════════════════════════
    // REQ-EE-001: extractState() — State Extraction for Persistence
    // ═══════════════════════════════════════════════════

describe('extractState()', () => {
        it('debe extraer el estado actual correctamente', fakeAsync(() => {
            const config = buildConfig(30);
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions(20));
            fixture.detectChanges();

            // Simular interacción del usuario
            component.selectAnswer(1, 'A');
            component.selectAnswer(2, 'B');
            component.selectAnswer(5, 'C');
            component.nextQuestion();
            component.nextQuestion();
            tick();

            const state = component.extractState('sess-test-123');

            expect(state.examSessionId).toBe('sess-test-123');
            expect(state.answers).toEqual({ 1: 'A', 2: 'B', 5: 'C' });
            expect(state.currentQuestionIndex).toBe(2);
            expect(state.timerSecondsRemaining).toBe(30* 60); // Initial timer
            expect(state.version).toBe(1);
            expect(state.examStartedAt).toBeTruthy();
            expect(state.persistedAt).toBeTruthy();
            // Note: examId is not included in extractState - it's added by SusieWrapper
            discardPeriodicTasks();
        }));

        it('debe incluir startedAt timestamp', fakeAsync(() => {
            const config = buildConfig(30);
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();
            tick(100); // Dejar que el effect inicialice startedAt

            const state = component.extractState('sess-1');

            expect(state.examStartedAt).toBeTruthy();
            expect(new Date(state.examStartedAt).getTime()).toBeLessThanOrEqual(Date.now());
            discardPeriodicTasks();
        }));

        it('debe capturar el timer actual', fakeAsync(() => {
            const config = buildConfig(5); // 5 min
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            // Avanzar 1 minuto
            tick(60000);

            const state = component.extractState('sess-1');

            // Timer state: 5min - 1min = 4min remaining (240 sec)
            // Can vary slightly due to timing
            expect(state.timerSecondsRemaining).toBeLessThanOrEqual(240);
            expect(state.timerSecondsRemaining).toBeGreaterThan(235);
            discardPeriodicTasks();
        }));

        it('debe incluir timestamp de persistencia', fakeAsync(() => {
            const config = buildConfig(30);
            fixture.componentRef.setInput('config', config);
            fixture.componentRef.setInput('questions', buildQuestions());
            fixture.detectChanges();

            const beforeTime = new Date().toISOString();
            tick();

            const state = component.extractState('sess-1');

            // persistedAt debe ser reciente
            const persistedAtTime = new Date(state.persistedAt).getTime();
            const beforeTimeMs = new Date(beforeTime).getTime();
            expect(persistedAtTime).toBeGreaterThanOrEqual(beforeTimeMs -1000);
            discardPeriodicTasks();
        }));
    });
});
