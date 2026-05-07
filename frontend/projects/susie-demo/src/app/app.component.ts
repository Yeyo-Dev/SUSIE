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
import { SUSIE_API_URL, EVALUACION_ID } from './core/config.tokens';

/**
 * Componente principal del Examen SUSIE.
 *
 * Carga la configuración desde el backend real vía ExamConfigService.
 * 
 * El token de autenticación se obtiene de:
 * 1. URL parameter: ?token=xyz
 * 2. sessionStorage (si ya se guardó previamente)
 * 3. Placeholder dev (solo en development)
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

  /** URL base del API (derivada de SUSIE_API_URL o URL param) */
  apiUrl = signal<string>('');

  /** Token de autenticación (derivada de URL param, sessionStorage, o dev fallback) */
  authToken = signal<string>('');

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

  // Configuración inyectada a través de environments
  private readonly API_URL = inject(SUSIE_API_URL);
  private readonly EVALUACION_ID = inject(EVALUACION_ID);

  async ngOnInit() {
    // Resolver token y apiUrl antes de cargar config
    this.resolveAuthAndApi();
    
    await this.loadConfigFromBackend();
  }

  /**
   * Resuelve el token de autenticación y la URL del API desde:
   * 1. URL parameters (?token=xyz&apiUrl=...)
   * 2. sessionStorage (si ya fue guardado)
   * 3. DI defaults (SUSIE_API_URL del environment)
   * 4. Dev fallback (solo en desarrollo)
   */
  private resolveAuthAndApi(): void {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 1. Token desde URL param
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      this.authToken.set(tokenFromUrl);
      sessionStorage.setItem('susie_auth_token', tokenFromUrl);
    }
    
    // 2. Token desde sessionStorage
    const tokenFromSession = sessionStorage.getItem('susie_auth_token');
    if (!tokenFromUrl && tokenFromSession) {
      this.authToken.set(tokenFromSession);
    }
    
    // 3. Dev fallback (solo en desarrollo, sin token hardcodeado)
    if (!this.authToken() && !this.isProduction()) {
      // Placeholder vacío para desarrollo - el backend debe validar
      // En desarrollo sin token, las peticiones fallarán con 401
      console.warn('⚠️ SUSIE: Sin token de autenticación. Proporciona ?token=xyz en la URL');
    }
    
    // 4. ApiUrl: prioridad URL param > DI default
    const apiUrlFromUrl = urlParams.get('apiUrl');
    if (apiUrlFromUrl) {
      this.apiUrl.set(apiUrlFromUrl);
    } else {
      this.apiUrl.set(this.API_URL);
    }
  }

  private isProduction(): boolean {
    return false; // TODO: usar environment.production cuando esté disponible
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
      this.configService.setBaseUrl(this.apiUrl());
      await this.delay(400);

      // Paso 2: Cargando configuración (llamada real al backend)
      this.loadingStep.set(2);
      this.loadingMessage.set('Cargando configuración del examen...');
      const backendConfig = await this.configService.loadConfig(this.EVALUACION_ID);

      // Paso 3: Preparando preguntas
      this.loadingStep.set(3);
      this.loadingMessage.set('Preparando preguntas...');
      // Inyectar token y URL del API
      backendConfig.susieApiUrl = this.apiUrl();
      backendConfig.authToken = this.authToken();
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
        onConsentResult: (result: ConsentResult) => { /* TODO: manejar resultado del consentimiento */ },
        onEnvironmentCheckResult: (result: { passed: boolean }) => { /* TODO: manejar resultado de entorno */ },
        onInactivityDetected: () => { /* TODO: manejar inactividad */ },
      },
      { debugMode: false } // TODO: Cambiar a !environment.production en producción
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
