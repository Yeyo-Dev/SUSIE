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
});
