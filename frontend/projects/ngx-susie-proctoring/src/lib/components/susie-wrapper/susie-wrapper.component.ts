import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  effect,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SusieConfig, SecurityViolation, EvidenceMetadata, EvidencePayload, SusieQuestion, ExamResult, ConsentResult, StepInfo } from '../../models/contracts';
import { MediaService } from '../../services/media.service';
import { EvidenceService } from '../../services/evidence.service';
import { SecurityService } from '../../services/security.service';
import { NetworkMonitorService } from '../../services/network-monitor.service';
import { InactivityService } from '../../services/inactivity.service';
import { GazeTrackingService } from '../../services/gaze-tracking.service';
import { WebSocketFeedbackService } from '../../services/websocket-feedback.service';

// Child components
import { CameraPipComponent } from '../camera-pip/camera-pip.component';
import { ConsentDialogComponent } from '../consent-dialog/consent-dialog.component';
import { EnvironmentCheckComponent } from '../environment-check/environment-check.component';
import { BiometricOnboardingComponent } from '../biometric-onboarding/biometric-onboarding.component';
import { ExamEngineComponent } from '../exam-engine/exam-engine.component';
import { GazeCalibrationComponent } from '../gaze-calibration/gaze-calibration.component';
import { ExamBriefingComponent } from '../exam-briefing/exam-briefing.component';
import { StepIndicatorComponent } from '../step-indicator/step-indicator.component';
import { PermissionPrepComponent } from '../permission-prep/permission-prep.component';
import { ElementRef, ViewChild } from '@angular/core';


/** Estado interno del flujo de proctoring */
type ProctoringState = 'PERMISSION_PREP' | 'CHECKING_PERMISSIONS' | 'CONSENT' | 'BIOMETRIC_CHECK' | 'ENVIRONMENT_CHECK' | 'GAZE_CALIBRATION' | 'EXAM_BRIEFING' | 'MONITORING';


@Component({
  selector: 'susie-wrapper',
  standalone: true,
  imports: [
    CommonModule,
    CameraPipComponent,
    ConsentDialogComponent,
    BiometricOnboardingComponent,
    EnvironmentCheckComponent,
    ExamEngineComponent,
    GazeCalibrationComponent,
    ExamBriefingComponent,
    StepIndicatorComponent,
    PermissionPrepComponent
  ],

  templateUrl: './susie-wrapper.component.html',
  styleUrl: './susie-wrapper.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    MediaService,
    EvidenceService,
    SecurityService,
    NetworkMonitorService,
    InactivityService,
    GazeTrackingService,
    WebSocketFeedbackService
  ]
})
export class SusieWrapperComponent implements OnInit, OnDestroy {
  /** Configuración del examen */
  config = input.required<SusieConfig>();

  /** (Opcional) Preguntas para el motor de examen interno */
  questions = input<SusieQuestion[]>([]);

  private mediaService = inject(MediaService);
  private evidenceService = inject(EvidenceService);
  private securityService = inject(SecurityService);
  private networkService = inject(NetworkMonitorService);
  private inactivityService = inject(InactivityService);
  private gazeService = inject(GazeTrackingService);
  private feedbackService = inject(WebSocketFeedbackService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  /** Alerta de IA en tiempo real (desde WebSocket de feedback) */
  aiAlert = this.feedbackService.currentAlert;

  // --- State Signals ---
  state = signal<ProctoringState>('CHECKING_PERMISSIONS');
  stateChange = output<ProctoringState>(); // Nuevo: emitir cambios de estado

  mediaStream = this.mediaService.stream;
  mediaError = this.mediaService.error;
  isOnline = this.networkService.isOnline;
  inactivityWarning = this.inactivityService.showWarning; // Nuevo: warning signal
  private snapshotInterval: any = null;
  tabSwitchCount = signal(0);
  needsFullscreenReturn = signal(false);
  needsFocusReturn = signal(false);

  /** Contadores de métricas de proctoring */
  private totalViolations = signal(0);
  private biometricSnapshotsCount = signal(0);
  private monitoringSnapshotsCount = signal(0);

  /** Estado de validación biométrica para el componente hijo */
  biometricValidating = signal(false);
  biometricError = signal<string | null>(null);
  /** Indica al hijo que la validación biométrica fue exitosa → mostrar feedback */
  biometricSuccess = signal(false);
  /** ID de sesión real devuelto por el backend (reemplaza 'pending') */
  resolvedSessionId = signal<string | null>(null);

  private visibilityReturnHandler = this.onVisibilityReturn.bind(this);

  /** Lista dinámica de pasos calculada desde securityPolicies */
  computedSteps = computed(() => {
    const p = this.config().securityPolicies;
    const steps: { id: string; label: string }[] = [];

    if (p.requireConsent) steps.push({ id: 'CONSENT', label: 'Consentimiento' });
    if (p.requireBiometrics) steps.push({ id: 'BIOMETRIC_CHECK', label: 'Biometría' });
    if (p.requireEnvironmentCheck) steps.push({ id: 'ENVIRONMENT_CHECK', label: 'Verificación' });
    if (p.requireGazeTracking) steps.push({ id: 'GAZE_CALIBRATION', label: 'Calibración' });
    steps.push({ id: 'EXAM_BRIEFING', label: 'Preparación' });
    steps.push({ id: 'MONITORING', label: 'Examen' });

    return steps;
  });

  /** Pasos con estado calculado según el estado actual de la máquina */
  stepsWithStatus = computed<StepInfo[]>(() => {
    const current = this.state();
    const steps = this.computedSteps();
    const currentIdx = steps.findIndex(s => s.id === current);

    return steps.map((step, i) => ({
      ...step,
      status: i < currentIdx ? 'completed' as const
        : i === currentIdx ? 'current' as const
          : 'upcoming' as const
    }));
  });

  /** Intentos de cambio de pestaña restantes */
  remainingTabSwitches = computed(() => {
    const max = this.config().maxTabSwitches;
    if (max === undefined) return undefined;
    return Math.max(0, max - this.tabSwitchCount());
  });

  @ViewChild('snapshotVideo') snapshotVideo!: ElementRef<HTMLVideoElement>;

  // Debug logs


  // Debug logs
  logs = signal<{ time: string; type: 'info' | 'error' | 'success'; msg: string; details?: any }[]>([]);

  constructor() {
    // Emitir cambios de estado al componente padre
    effect(() => {
      this.stateChange.emit(this.state());
    });

    // Efecto para monitoreo de red
    effect(() => {
      if (!this.isOnline()) {
        this.log('error', '⚠️ Conexión perdida - Modo offline activado');
      } else {
        this.log('success', '✅ Conexión estable');
      }
    }, { allowSignalWrites: true });

    // Configurar servicios al recibir config
    effect(() => {
      const cfg = this.config();
      if (cfg) {
        this.evidenceService.configure(cfg.apiUrl, cfg.authToken, cfg.sessionContext);

        // Conectar logger del servicio al debug panel del wrapper
        this.evidenceService.setLogger((type, msg, details) => {
          this.log(type, msg, details);
        });

        this.inactivityService.configure(
          cfg.inactivityTimeoutMinutes ?? 3,
          cfg.onInactivityDetected
        );
      }
    }, { allowSignalWrites: true });
  }

  async ngOnInit() {
    this.log('info', '🚀 Inicializando SusieWrapper...');
    // Siempre bloquear el click derecho desde el segundo 1 del wrapper
    document.addEventListener('contextmenu', this.preventGlobalContextMenu);
    // Siempre bloquear atajos de teclado de DevTools (F12, etc.)
    document.addEventListener('keydown', this.preventGlobalDevTools);
    await this.initializeFlow();
  }

  private preventGlobalContextMenu = (e: Event) => {
    e.preventDefault();
    this.log('info', 'Click derecho deshabilitado globalmente.');
    return false;
  };

  private preventGlobalDevTools = (e: KeyboardEvent) => {
    // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
      (e.ctrlKey && e.key === 'u')
    ) {
      e.preventDefault();
      this.log('error', '⚠️ Intento de abrir herramientas de desarrollador bloqueado globalmente.');

      // Si ya estamos en monitoreo, notificamos como violación formal
      if (this.state() === 'MONITORING') {
        this.handleViolation({
          type: 'INSPECTION_ATTEMPT',
          message: 'Intento de abrir herramientas de desarrollador por atajo de teclado',
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  ngOnDestroy() {
    this.log('info', '🛑 Deteniendo SusieWrapper...');
    document.removeEventListener('contextmenu', this.preventGlobalContextMenu);
    document.removeEventListener('keydown', this.preventGlobalDevTools);

    // Si se destruye el componente y la sesión estaba activa, notificar al servidor
    if (this.state() === 'MONITORING') {
      this.evidenceService.endSession('cancelled');
    }

    this.feedbackService.disconnect();
    this.mediaService.stop();
    this.evidenceService.stopAudioRecording();
    this.stopSnapshotLoop();
    this.securityService.disableProtection();
    this.gazeService.stop();
    document.removeEventListener('visibilitychange', this.visibilityReturnHandler);
    this.inactivityService.stopMonitoring();
  }

  private async initializeFlow() {

    const policies = this.config().securityPolicies;

    // 1. Permisos de Media - Ir a pantalla de preparación
    // Si requiere Biometría, IMPLÍCITAMENTE requiere cámara, aunque requireCamera sea false
    const needsCamera = Boolean(policies.requireCamera || policies.requireBiometrics);

    if (needsCamera || policies.requireMicrophone) {
      // NUEVO: Ir a la pantalla de preparación de permisos primero
      this.state.set('PERMISSION_PREP');
      // El PermissionPrepComponent maneja la solicitud de permisos
      // y emite permissionPrepared cuando el usuario confirma el preview
      return;
    }

    // Si no se requieren permisos, continuar al flujo normal (solicitar en background)
    // pero ir directo al siguiente paso
    this.advanceAfterPermissions();
  }

  /**
   * Avanza al siguiente paso después de que los permisos fueron concedidos
   * (usado después de PERMISSION_PREP)
   */
  handlePermissionPrepared() {
    this.log('success', '🎥 Permisos listos - Avanzando');
    this.advanceAfterPermissions();
  }

  /**
   * Lógica para avanzar después de que los permisos fueron concedidos
   */
  private advanceAfterPermissions() {
    const policies = this.config().securityPolicies;

    // 2. Consentimiento
    if (policies.requireConsent) {
      this.state.set('CONSENT');
    } else if (policies.requireEnvironmentCheck) {
      this.state.set('ENVIRONMENT_CHECK');
    } else if (policies.requireGazeTracking) {
      this.state.set('GAZE_CALIBRATION');
    } else {
      this.goToExamBriefing();
    }
  }

  /**
   * Maneja la respuesta del diálogo de consentimiento.
   */
  /**
   * Maneja la respuesta del diálogo de consentimiento.
   */
  handleConsent(result: ConsentResult) {
    this.config().onConsentResult?.(result);

    if (result.accepted) {
      this.log('success', '✅ Términos y condiciones aceptados');

      if (this.config().securityPolicies.requireBiometrics) {
        this.state.set('BIOMETRIC_CHECK');
      } else if (this.config().securityPolicies.requireEnvironmentCheck) {
        this.state.set('ENVIRONMENT_CHECK');
      } else {
        this.goToExamBriefing();
      }

    } else {
      this.log('error', '❌ Consentimiento rechazado por usuario');
      // El componente susie-consent-dialog maneja el estado de rechazo visualmente (botón reconsiderar)
    }
  }

  /**
   * Maneja el completado del onboarding biométrico.
   * Realiza la validación contra el endpoint dedicado del backend.
   * Bloquea el avance si la validación falla.
   */
  async handleBiometricCompleted(event: { photo: Blob }) {
    this.log('success', '📸 Foto biométrica capturada');
    this.ngZone.run(() => {
      this.biometricValidating.set(true);
      this.biometricError.set(null);
      this.biometricSuccess.set(false);
    });

    const userId = this.config().sessionContext?.userId || 'anonymous';
    const isValid = await this.evidenceService.validateBiometric(event.photo, userId);

    this.ngZone.run(() => {
      this.biometricValidating.set(false);
      this.biometricSnapshotsCount.update(c => c + 1);

      if (!isValid) {
        this.log('error', '⚠️ Validación biométrica fallida');
        this.biometricError.set('La validación biométrica ha fallado. Revisa tu iluminación o encuadre e intenta de nuevo.');
        return;
      }

      this.log('success', '✅ Validación biométrica exitosa — mostrando feedback al usuario');
      this.biometricSuccess.set(true);
      // Avanzar tras 2s de feedback
      setTimeout(() => this.ngZone.run(() => this.handleBiometricSuccessConfirmed()), 2000);
    });
  }

  /**
   * Llamado después de que el usuario vio el feedback de éxito (2s).
   * Ahora sí avanzamos al siguiente paso del flujo.
   */
  handleBiometricSuccessConfirmed() {
    this.log('success', '👤 Identidad verificada — avanzando flujo');
    this.biometricSuccess.set(false);

    // Avanzar flujo solo si la validación fue exitosa
    if (this.config().securityPolicies.requireEnvironmentCheck) {
      this.log('info', '🔜 Avanzando a Environment Check');
      this.state.set('ENVIRONMENT_CHECK');
    } else if (this.config().securityPolicies.requireGazeTracking) {
      this.log('info', '🔜 Avanzando a Calibración de Gaze');
      this.gazeService.configure(
        {},
        () => { },
        () => this.handleGazeDeviation()
      );
      this.state.set('GAZE_CALIBRATION');
    } else {
      this.log('info', '🔜 Avanzando a Briefing del Examen');
      this.goToExamBriefing();
    }
  }

  /**
   * Limpia el estado de error biométrico cuando el usuario solicita reintentar.
   */
  handleBiometricRetake() {
    this.biometricError.set(null);
  }

  /**
   * Maneja el resultado de la verificación de entorno.
   */
  handleEnvironmentCheck(result: { passed: boolean }) {

    if (result.passed) {
      this.log('success', '✅ Verificación de entorno exitosa');
      if (this.config().securityPolicies.requireGazeTracking) {
        this.log('info', '🔜 Avanzando a Calibración de Gaze');
        // Configurar el gazeService SIN logger para no ensuciar la consola durante calibración
        this.gazeService.configure(
          {},
          () => { }, // Empty logger
          () => this.handleGazeDeviation()
        );
        this.state.set('GAZE_CALIBRATION');
      } else {
        this.log('info', '🔜 Avanzando a Briefing del Examen');
        this.goToExamBriefing();
      }
    } else {
      this.log('error', '❌ Falló verificación de entorno');
    }
  }

  /**
   * Maneja la finalización exitosa de la calibración de gaze tracking.
   */
  handleGazeCalibrationCompleted() {
    this.log('success', '👁️ Calibración de gaze completada');
    this.goToExamBriefing();
  }

  /**
   * Transiciona al briefing pre-examen.
   */
  private goToExamBriefing() {
    this.log('info', '📋 Mostrando briefing del examen');
    this.state.set('EXAM_BRIEFING');
  }

  /**
   * Maneja la confirmación del briefing — inicia el monitoreo y el examen.
   */
  handleBriefingAcknowledged() {
    this.log('success', '✅ Briefing confirmado — Iniciando examen');
    this.startMonitoring();
  }

  /**
   * Inicia el monitoreo activo (Examen en curso).
   */
  private async startMonitoring() {
    this.state.set('MONITORING');
    const policies = this.config().securityPolicies;

    // Activar protecciones
    if (policies.requireFullscreen) {
      this.securityService.enterFullscreen();
    }

    this.securityService.enableProtection(policies, (violation) => {
      this.handleViolation(violation);

    });

    // Iniciar snapshots periódicos
    if (this.config().securityPolicies.requireCamera && this.config().capture?.snapshotIntervalSeconds) {
      this.startSnapshotLoop(this.config().capture!.snapshotIntervalSeconds);
    }

    // Iniciar grabación de audio
    if (this.config().securityPolicies.requireMicrophone && this.config().audioConfig?.enabled) {
      const audioStream = this.mediaService.getAudioStream();
      if (audioStream) {
        this.evidenceService.startAudioRecording(audioStream, this.config().audioConfig);
      } else {
        this.log('error', '⚠️ Sin stream de audio. No se grabará audio.');
      }
    }

    // Gaze Tracking ya fue configurado antes de la calibración
    if (policies.requireGazeTracking && this.gazeService.isCalibrated()) {
      // Habilitar logger de nuevo para la fase de monitoreo
      this.gazeService.configure(
        {},
        (type, msg, details) => this.log(type, msg, details)
      );
      this.log('info', '👁️ Gaze Tracking activo durante monitoreo');
    }

    // Iniciar monitoreo de inactividad
    this.inactivityService.startMonitoring();

    // Registrar listener para recuperación de fullscreen al regresar a la pestaña
    if (policies.requireFullscreen) {
      document.addEventListener('visibilitychange', this.visibilityReturnHandler);
    }

    // Notificar al backend que inició la sesión y obtener el ID real
    const realSessionId = await this.evidenceService.startSession();

    // Almacenar el ID real para usarlo en metadata del resultado final
    if (realSessionId) {
      this.resolvedSessionId.set(realSessionId);
    }

    // Conectar canal de feedback en tiempo real de la IA
    const apiUrl = this.config().apiUrl || '';
    const wsUrl = apiUrl.replace(/^http/, 'ws');
    const sessionId = realSessionId || this.config().sessionContext?.examSessionId || '';
    if (wsUrl && sessionId) {
      this.feedbackService.connect(wsUrl, sessionId);
    }

    this.log('info', '🛡️ Monitoreo activo iniciado');
  }

  /**
   * Maneja una desviación sostenida de la mirada (GAZE_DEVIATION).
   */
  private handleGazeDeviation() {
    const violation: SecurityViolation = {
      type: 'GAZE_DEVIATION',
      message: 'La mirada del usuario se desvió fuera del área de la pantalla por un período prolongado',
      timestamp: new Date().toISOString()
    };
    this.handleViolation(violation);
  }


  private handleViolation(violation: SecurityViolation) {
    this.totalViolations.update(c => c + 1);
    this.log('error', `🚨 Violación detectada: ${violation.type} - ${violation.message}`);

    // Mapear el tipo de violación al trigger esperado por el backend
    const triggerMap: Record<string, string> = {
      'TAB_SWITCH': 'TAB_SWITCH',
      'FULLSCREEN_EXIT': 'FULLSCREEN_EXIT',
      'FOCUS_LOST': 'LOSS_FOCUS',
      'INSPECTION_ATTEMPT': 'DEVTOOLS_OPENED',
      'NAVIGATION_ATTEMPT': 'NAVIGATION_ATTEMPT',
      'RELOAD_ATTEMPT': 'RELOAD_ATTEMPT',
      'CLIPBOARD_ATTEMPT': 'CLIPBOARD_ATTEMPT',
      'GAZE_DEVIATION': 'GAZE_DEVIATION',
    };

    // Enviar evento al backend con trigger específico
    this.evidenceService.sendEvent({
      type: 'BROWSER_EVENT',
      trigger: triggerMap[violation.type] || violation.type,
      browser_focus: document.hasFocus()
    } as any);

    // Lógica de maxTabSwitches: solo cancelar cuando se alcance el límite
    if (violation.type === 'TAB_SWITCH' || violation.type === 'FOCUS_LOST') {
      const count = this.tabSwitchCount() + 1;
      this.tabSwitchCount.set(count);
      const max = this.config().maxTabSwitches;

      if (max !== undefined && count >= max) {
        this.log('error', `❌ Límite de abandonos de pantalla alcanzado (${count}/${max}). Cancelando examen.`);
        this.config().onSecurityViolation?.(violation);
      } else {
        this.log('error', `⚠️ Abandono de pantalla ${count}/${max ?? '∞'} — siguiente cancelará el examen`);
        if (violation.type === 'FOCUS_LOST') {
          this.needsFocusReturn.set(true);
        }
      }
    } else if (violation.type === 'FULLSCREEN_EXIT') {
      // No cancelar — mostrar overlay de recuperación para que el usuario restaure fullscreen
      this.needsFullscreenReturn.set(true);
      this.log('error', '⚠️ Pantalla completa perdida. Mostrando overlay de recuperación.');
    } else {
      // Otras violaciones se reportan inmediatamente
      this.config().onSecurityViolation?.(violation);
    }
  }

  /** Listener de visibilidad: al regresar a la pestaña, verifica si requiere fullscreen */
  private onVisibilityReturn() {
    if (!document.hidden && this.config().securityPolicies.requireFullscreen && !document.fullscreenElement) {
      this.needsFullscreenReturn.set(true);
      this.log('error', '⚠️ Se perdió la pantalla completa. Esperando al usuario para restaurarla.');
    }
  }

  /** Restaurar pantalla completa tras regresar de otra pestaña */
  async returnToFullscreen() {
    try {
      await this.securityService.enterFullscreen();
      this.needsFullscreenReturn.set(false);
      this.log('success', '✅ Pantalla completa restaurada.');
    } catch (err) {
      this.log('error', '❌ No se pudo restaurar la pantalla completa.');
    }
  }

  /** Restaurar foco si se perdió por cambiar de aplicación/escritorio */
  returnToFocus() {
    this.needsFocusReturn.set(false);
    this.log('success', '✅ Foco en la ventana restaurado.');
  }

  /** Reintenta solicitar permisos tras un error */
  retryMedia() {
    this.mediaError.set(null);
    this.initializeFlow();
  }

  /** Confirma actividad tras warning de inactividad */
  confirmActivity() {
    this.inactivityService.resetTimer();
  }

  /** Callback del motor de examen */
  handleExamFinished(result: ExamResult) {
    this.log('success', '🏁 Examen finalizado');
    this.feedbackService.disconnect();
    this.evidenceService.endSession('submitted');

    // Enriquecer resultado con métricas de proctoring
    const enrichedResult: ExamResult = {
      ...result,
      metadata: {
        ...result.metadata,
        sessionId: this.resolvedSessionId() ?? this.config().sessionContext?.examSessionId,
      },
      proctoringSummary: {
        totalViolations: this.totalViolations(),
        tabSwitches: this.tabSwitchCount(),
        snapshots: {
          biometric: this.biometricSnapshotsCount(),
          monitoring: this.monitoringSnapshotsCount(),
        },
      },
    };

    this.config().onExamFinished?.(enrichedResult);
  }

  // --- Debug Helper ---
  log(type: 'info' | 'error' | 'success', msg: string, details?: any) {
    if (this.config().debugMode) {
      this.logs.update(prev => [{
        time: new Date().toLocaleTimeString(),
        type,
        msg,
        details
      }, ...prev]);
    }
  }

  clearLogs() {
    this.logs.set([]);
  }

  /** Descarta la alerta crítica manualmente (botón "Entendido") */
  dismissCriticalAlert() {
    this.feedbackService.currentAlert.set(null);
    this.log('info', '✅ Alerta crítica descartada por el usuario');
  }

  private startSnapshotLoop(intervalSeconds: number) {
    this.log('info', `📸 Iniciando snapshots automáticos cada ${intervalSeconds}s`);
    this.stopSnapshotLoop();

    // Attach stream to hidden video for capture
    setTimeout(() => {
      if (this.snapshotVideo && this.mediaStream()) {
        const videoEl = this.snapshotVideo.nativeElement;
        videoEl.srcObject = this.mediaStream();
        // Forzar muted para evitar eco de audio
        videoEl.muted = true;
        videoEl.volume = 0;
      }
    });

    this.snapshotInterval = setInterval(() => {
      this.captureSnapshot();
    }, intervalSeconds * 1000);
  }

  private stopSnapshotLoop() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  private captureSnapshot() {
    if (!this.snapshotVideo?.nativeElement) return;
    const video = this.snapshotVideo.nativeElement;

    // Check if video is ready
    if (video.readyState < 2) return; // HAVE_CURRENT_DATA

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) {
          // Adjuntar coordenadas de gaze si el tracking está activo
          const gazeHistory = this.gazeService.isCalibrated()
            ? this.gazeService.flushGazeBuffer()
            : undefined;

          this.evidenceService.sendEvent({
            type: 'SNAPSHOT',
            browser_focus: document.hasFocus(),
            file: blob,
            ...(gazeHistory?.length ? { gaze_history: gazeHistory } : {})
          } as any);
          this.monitoringSnapshotsCount.update(c => c + 1);
        }
      }, 'image/jpeg', 0.6); // Calidad media
    }
  }
}

