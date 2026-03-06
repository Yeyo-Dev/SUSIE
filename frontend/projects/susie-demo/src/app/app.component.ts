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

/**
 * Componente principal del Examen SUSIE.
 *
 * Carga la configuración desde el backend real vía ExamConfigService.
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
  examState = signal<'loading' | 'taking' | 'submitted' | 'cancelled' | 'error'>('loading');

  /** Resultado final del examen (respuestas y metadata). */
  examResult = signal<ExamResult | null>(null);

  /** Razón por la cual el examen fue cancelado. */
  cancellationReason = signal('');

  /** Estado interno del wrapper SUSIE (para ocultar el topbar durante el onboarding) */
  wrapperState = signal<string>('CHECKING_PERMISSIONS');



  /** Paso actual de carga (1-5) */
  loadingStep = signal(0);

  /** Mensaje descriptivo del paso de carga actual */
  loadingMessage = signal('Inicializando...');

  /** Mensaje de error detallado para el usuario */
  errorDetail = signal('');

  /** Configuración SUSIE (se construye después de cargar del backend). */
  examConfig = signal<SusieConfig | null>(null);

  /** Lista de preguntas */
  questions = signal<SusieQuestion[]>([]);

  // --- Configuración de conexión ---
  private readonly API_URL = 'http://localhost:8000/susie/api/v1';
  private readonly EVALUACION_ID = '1';
  private readonly AUTH_TOKEN = 'demo-token';

  async ngOnInit() {
    await this.loadConfigFromBackend();
  }

  /** Pausa reactiva para que Angular pueda repintar la UI entre pasos. */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async loadConfigFromBackend() {
    this.examState.set('loading');
    this.loadingStep.set(0);
    this.loadingMessage.set('Inicializando...');

    try {
      // Paso 1: Conectando
      this.loadingStep.set(1);
      this.loadingMessage.set('Conectando con el servidor SUSIE...');
      this.configService.setBaseUrl(this.API_URL);
      await this.delay(400);

      // Paso 2: Cargando configuración (llamada real al backend)
      this.loadingStep.set(2);
      this.loadingMessage.set('Cargando configuración del examen...');
      const backendConfig = await this.configService.loadConfig(this.EVALUACION_ID);

      // Paso 3: Preparando preguntas
      this.loadingStep.set(3);
      this.loadingMessage.set('Preparando preguntas...');
      // Inyectar token y URL del API
      backendConfig.susieApiUrl = this.API_URL;
      backendConfig.authToken = this.AUTH_TOKEN;
      await this.delay(350);

      // Paso 4: Configurando supervisión
      this.loadingStep.set(4);
      this.loadingMessage.set('Configurando supervisión...');
      await this.delay(350);

      // Paso 5: Listo
      this.loadingStep.set(5);
      this.loadingMessage.set('¡Todo listo!');
      await this.delay(500);

      this.buildSusieConfig(backendConfig);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error al cargar configuración:', message);
      this.errorDetail.set(message);
      this.examState.set('error');
    }
  }

  /** Reintenta la conexión con el backend */
  retryConnection() {
    this.loadConfigFromBackend();
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
      { debugMode: false }
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
