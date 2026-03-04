import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common'; // Importante para KeyValuePipe, DatePipe, etc.
import { SusieConfig, SusieQuestion, ExamResult } from '../../models/contracts';

/**
 * Motor de Examen de SUSIE.
 * Gestiona la presentación de preguntas, paginación, selección de respuestas,
 * temporizador interno y finalización del examen.
 */
@Component({
    selector: 'susie-exam-engine',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './exam-engine.component.html',
    styleUrl: './exam-engine.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExamEngineComponent {
    /** Configuración del examen (duración, título). */
    config = input.required<SusieConfig>();

    /** Lista de preguntas a renderizar. */
    questions = input.required<SusieQuestion[]>();

    /** Evento emitido al finalizar el examen (submit o timeout). */
    examFinished = output<ExamResult>();

    // --- Estado ---

    /** Índice de la pregunta actual (0-based). */
    currentIndex = signal(0);

    /** Mapa de respuestas seleccionadas: { questionId: optionValue } */
    answers = signal<Record<number, string>>({});

    /** Tiempo restante en segundos. */
    timerSeconds = signal(0);

    /** Intervalo del timer. */
    private timerInterval: any;

    /** Notificación flotante (Toast). */
    toast = signal<{ message: string; type: 'info' | 'warning' | 'critical' } | null>(null);

    /** Controla la visibilidad del modal de confirmación. */
    showConfirmModal = signal(false);

    // --- Computados ---

    /** Pregunta actual basada en el índice. */
    currentQuestion = computed(() => this.questions()[this.currentIndex()]);

    /** Progreso del examen (0-100). */
    progressPercent = computed(() => {
        const total = this.questions().length;
        if (total === 0) return 0;
        // Progreso basado en preguntas vistas/contestadas o solo índice?
        // Usaremos índice + 1 visualmente
        return ((this.currentIndex() + 1) / total) * 100;
    });

    /** Tiempo formateado MM:SS. */
    timerFormatted = computed(() => {
        const s = this.timerSeconds();
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    });

    /** Indica si el tiempo es crítico (< 1 min). */
    isUrgent = computed(() => this.timerSeconds() < 60);

    /** Cantidad de respuestas contestadas. */
    answeredCount = computed(() => Object.keys(this.answers()).length);

    constructor() {
        // Escuchar cambios de config para inicializar timer si cambia dinámicamente
        effect(() => {
            const ctx = this.config().sessionContext;
            const mins = ctx.durationMinutes;
            console.log('[ExamEngine] Effect triggered. Duration:', mins, 'Current Timer:', this.timerSeconds());

            if (mins > 0 && this.timerSeconds() === 0) {
                console.log('[ExamEngine] Starting timer for minutes:', mins);
                this.startTimer(mins * 60);
            } else {
                console.log('[ExamEngine] Timer not started. Condition failed.');
            }
        }, { allowSignalWrites: true });
    }

    private startTimer(durationSec: number) {
        this.timerSeconds.set(durationSec);
        clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            const current = this.timerSeconds();
            if (current <= 0) {
                this.autoSubmit();
                return;
            }
            this.timerSeconds.set(current - 1);
            this.checkTimerWarnings(current - 1);
        }, 1000);
    }

    private checkTimerWarnings(seconds: number) {
        if (seconds === 300) { // 5 min
            this.toast.set({ message: '⏱️ Quedan 5 minutos', type: 'info' });
            setTimeout(() => this.dismissToast(), 5000);
        } else if (seconds === 60) { // 1 min
            this.toast.set({ message: '⚠️ ¡Queda 1 minuto! Revisa tus respuestas.', type: 'critical' });
        } else if (seconds === 10) {
            this.toast.set({ message: '🚨 10 segundos... El examen se enviará automáticamente.', type: 'critical' });
        }
    }

    private stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // --- Acciones ---

    dismissToast() {
        this.toast.set(null);
    }

    selectAnswer(questionId: number, option: string) {
        this.answers.update(prev => ({
            ...prev,
            [questionId]: option
        }));
    }

    nextQuestion() {
        // Dismiss toast al interactuar si es info/warning
        if (this.toast()?.type !== 'critical') {
            this.dismissToast();
        }
        if (this.currentIndex() < this.questions().length - 1) {
            this.currentIndex.update(i => i + 1);
        }
    }

    prevQuestion() {
        if (this.currentIndex() > 0) {
            this.currentIndex.update(i => i - 1);
        }
    }

    /**
     * Inicia el proceso de envío.
     * Abre el modal de confirmación en lugar de enviar directamente.
     */
    submitExam() {
        this.showConfirmModal.set(true);
    }

    confirmSubmit() {
        this.showConfirmModal.set(false);
        this.finish();
    }

    /**
     * Auto-envío mandatorio al expirar el temporizador.
     * Cierra cualquier modal abierto y finaliza el examen directamente.
     */
    private autoSubmit() {
        this.showConfirmModal.set(false);
        this.toast.set({ message: '⏰ Tiempo agotado. El examen se ha enviado automáticamente.', type: 'critical' });
        this.finish();
    }

    cancelSubmit() {
        this.showConfirmModal.set(false);
    }

    private finish() {
        this.stopTimer();
        this.examFinished.emit({
            answers: this.answers(),
            completedAt: new Date().toISOString(),
        });
    }
}
