import { Component, signal, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SusieWrapperComponent, SusieConfig, ExamResult } from 'ngx-susie-proctoring';
import { ExamQuestion, ExamState, EXAM_QUESTIONS, createExamConfig } from './exam-data';

/**
 * Componente principal de la Demo de Examen SUSIE.
 *
 * Utiliza el `SusieWrapperComponent` para gestionar todo el ciclo de vida del examen.
 * El componente demo solo provee la configuración y las preguntas.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SusieWrapperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  /** Lista estática de preguntas del examen. */
  readonly questions: ExamQuestion[] = EXAM_QUESTIONS;

  /** Estado actual del flujo del examen */
  examState = signal<ExamState>('taking');

  /** Resultado final del examen (respuestas y metadata). */
  examResult = signal<ExamResult | null>(null);

  /** Razón por la cual el examen fue cancelado. */
  cancellationReason = signal('');

  // --- Configuración de SUSIE ---

  /** Objeto de configuración para el componente `susie-wrapper`. */
  examConfig: SusieConfig = createExamConfig(this);

  ngOnInit() {
    // Ya no es necesario inicializar timers aquí, el motor los maneja.
  }

  /**
   * Callback invocado cuando el motor de examen finaliza (por envío o tiempo).
   */
  handleExamFinished(result: ExamResult) {
    this.examResult.set(result);
    this.examState.set('submitted');
  }

  /**
   * Cancela el examen debido a una violación de seguridad o error.
   * @param reason Descripción del motivo de la cancelación.
   */
  cancelExam(reason: string) {
    this.cancellationReason.set(reason);
    this.examState.set('cancelled');
  }

  /** Reinicia el examen recargando la aplicación. */
  resetExam() {
    window.location.reload();
  }
}
