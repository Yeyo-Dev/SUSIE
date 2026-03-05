import { Component, signal, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  SusieWrapperComponent,
  SusieConfig,
  ExamResult,
  SusieQuestion,
  mapToSusieConfig,
  ExamConfigService,
  ChaindrencialesExamConfig,
  SecurityViolation,
  ConsentResult,
} from 'ngx-susie-proctoring';
import { MOCK_CHAINDRENCIALES_CONFIG } from './exam-data';

/**
 * Componente principal de la Demo de Examen SUSIE.
 *
 * Carga la configuración desde el backend real vía ExamConfigService.
 * Si el backend no está disponible, cae al mock como fallback.
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
  private readonly configService = inject(ExamConfigService);

  /** Estado actual del flujo del examen */
  examState = signal<'loading' | 'taking' | 'submitted' | 'cancelled'>('loading');

  /** Resultado final del examen (respuestas y metadata). */
  examResult = signal<ExamResult | null>(null);

  /** Razón por la cual el examen fue cancelado. */
  cancellationReason = signal('');

  /** Estado interno del wrapper SUSIE (para ocultar el topbar durante el onboarding) */
  wrapperState = signal<string>('CHECKING_PERMISSIONS');

  /** Error al cargar configuración */
  loadError = signal<string | null>(null);

  /** Configuración SUSIE (se construye después de cargar del backend). */
  examConfig = signal<SusieConfig | null>(null);

  /** Lista de preguntas */
  questions = signal<SusieQuestion[]>([]);

  // --- URL y evaluacion ID de prueba ---
  private readonly API_URL = 'http://localhost:8000/susie/api/v1';
  private readonly EVALUACION_ID = '1';  // ID de prueba
  private readonly AUTH_TOKEN = 'demo-token';  // Token de prueba

  async ngOnInit() {
    await this.loadConfigFromBackend();
  }

  private async loadConfigFromBackend() {
    this.examState.set('loading');
    this.loadError.set(null);

    try {
      this.configService.setBaseUrl(this.API_URL);
      const backendConfig = await this.configService.loadConfig(this.EVALUACION_ID);

      // Inyectar token y URL del API (el backend no los provee aún)
      backendConfig.susieApiUrl = this.API_URL;
      backendConfig.authToken = this.AUTH_TOKEN;

      this.buildSusieConfig(backendConfig);
      console.log('✅ Configuración cargada desde el backend', backendConfig);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('⚠️ No se pudo cargar desde el backend, usando mock como fallback:', message);
      this.loadError.set('Usando datos mock (backend no disponible)');
      this.buildSusieConfig(MOCK_CHAINDRENCIALES_CONFIG);
    }
  }

  private buildSusieConfig(source: ChaindrencialesExamConfig) {
    const config = mapToSusieConfig(
      source,
      {
        onSecurityViolation: (violation: SecurityViolation) => this.cancelExam(violation.message),
        onExamFinished: (result: ExamResult) => this.handleExamFinished(result),
        onConsentResult: (result: ConsentResult) => console.log('📋 Resultado del consentimiento:', result),
        onEnvironmentCheckResult: (result: { passed: boolean }) => console.log('🔍 Resultado de verificación de entorno:', result),
        onInactivityDetected: () => console.log('⏸️ Inactividad detectada — usuario confirmó presencia'),
      },
      { debugMode: true }
    );

    this.examConfig.set(config);
    this.questions.set(source.questions);
    this.examState.set('taking');
  }

  /** Captura cambios de estado desde el wrapper */
  handleStateChange(newState: string) {
    this.wrapperState.set(newState);
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
