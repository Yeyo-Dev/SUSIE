import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SusieWrapperComponent, SusieConfig, ExamResult, SusieQuestion, mapToSusieConfig } from 'ngx-susie-proctoring';
import { MOCK_CHAINDRENCIALES_CONFIG } from './exam-data';

/**
 * Componente principal de la Demo de Examen SUSIE.
 *
 * En producción (Chaindrenciales), la config se cargará vía ExamConfigService.
 * En desarrollo, usa MOCK_CHAINDRENCIALES_CONFIG como fallback.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SusieWrapperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  /** Estado actual del flujo del examen */
  examState = signal<'taking' | 'submitted' | 'cancelled'>('taking');

  /** Resultado final del examen (respuestas y metadata). */
  examResult = signal<ExamResult | null>(null);

  /** Razón por la cual el examen fue cancelado. */
  cancellationReason = signal('');

  /**
   * Configuración SUSIE construida a partir de la config de Chaindrenciales.
   * mapToSusieConfig() transforma supervision → securityPolicies, deriva
   * consent/fullscreen/etc., y conecta los callbacks.
   */
  examConfig: SusieConfig = mapToSusieConfig(
    MOCK_CHAINDRENCIALES_CONFIG,
    {
      onSecurityViolation: (violation) => this.cancelExam(violation.message),
      onExamFinished: (result) => this.handleExamFinished(result),
      onConsentResult: (result) => console.log('📋 Resultado del consentimiento:', result),
      onEnvironmentCheckResult: (result) => console.log('🔍 Resultado de verificación de entorno:', result),
      onInactivityDetected: () => console.log('⏸️ Inactividad detectada — usuario confirmó presencia'),
    },
    { debugMode: true }
  );

  /** Lista de preguntas extraída del config (para referencia en el template). */
  readonly questions: SusieQuestion[] = MOCK_CHAINDRENCIALES_CONFIG.questions;

  /**
   * Callback invocado cuando el motor de examen finaliza (por envío o tiempo).
   */
  handleExamFinished(result: ExamResult) {
    this.examResult.set(result);
    this.examState.set('submitted');
  }

  /**
   * Cancela el examen debido a una violación de seguridad o error.
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
