import { Injectable, signal, computed, inject, effect, output, OnDestroy } from '@angular/core';
import { SusieConfig, StepInfo, SecurityViolation, ConsentResult, ExamResult, LoggerFn } from '../models/contracts';
import { MediaService } from './media.service';
import { EvidenceService } from './evidence.service';
import { SecurityService } from './security.service';
import { NetworkMonitorService } from './network-monitor.service';
import { InactivityService } from './inactivity.service';
import { GazeTrackingService } from './gaze-tracking.service';
import { WebSocketFeedbackService } from './websocket-feedback.service';
import { DestroyRefUtility } from '../utils/destroy-ref.utility';

/** Estado interno del flujo de proctoring */
export type ProctoringState = 
  | 'PERMISSION_PREP' 
  | 'CHECKING_PERMISSIONS' 
  | 'CONSENT' 
  | 'BIOMETRIC_CHECK' 
  | 'ENVIRONMENT_CHECK' 
  | 'GAZE_CALIBRATION' 
  | 'EXAM_BRIEFING' 
  | 'MONITORING';

/**
 * Interfaz de callbacks que el orchestrator emite al componente.
 * Separa la lógica de negocio de la presentación.
 */
export interface OrchestratorCallbacks {
  onStateChange: (state: ProctoringState) => void;
  onViolation: (violation: SecurityViolation) => void;
  onExamFinished: (result: ExamResult) => void;
  onLog: LoggerFn;
  onBiometricValidationRequired: (photo: Blob, userId: string) => Promise<boolean>;
  onSessionStarted: (sessionId: string) => void;
  onInactivityWarning: () => void;
  onNetworkStatusChange: (isOnline: boolean) => void;
}

/**
 * Servicio que maneja la máquina de estados del flujo de proctoring.
 * Encapsula toda la lógica de transiciones, configuración y callbacks.
 * 
 * El componente wrapper solo actúa como "glue" entre child components
 * y este servicio.
 */
@Injectable({ providedIn: 'root' })
export class ProctoringOrchestratorService implements OnDestroy {
  // Services
  private readonly mediaService = inject(MediaService);
  private readonly evidenceService = inject(EvidenceService);
  private readonly securityService = inject(SecurityService);
  private readonly networkService = inject(NetworkMonitorService);
  private readonly inactivityService = inject(InactivityService);
  private readonly gazeService = inject(GazeTrackingService);
  private readonly feedbackService = inject(WebSocketFeedbackService);
  private readonly cleanup = inject(DestroyRefUtility);

  // --- State Signals ---
  readonly state = signal<ProctoringState>('CHECKING_PERMISSIONS');
  
  // Exposed signals for template
  readonly mediaStream = this.mediaService.stream;
  readonly mediaError = this.mediaService.error;
  readonly isOnline = this.networkService.isOnline;
  readonly aiAlert = this.feedbackService.currentAlert;
  readonly inactivityWarning = this.inactivityService.showWarning;

  constructor() {
    // Effect: network monitoring
    effect(() => {
      if (!this.isOnline()) {
        this.log('error', '⚠️ Conexión perdida - Modo offline activado');
        this.callbacks?.onNetworkStatusChange(false);
      } else {
        this.log('success', '✅ Conexión estable');
        this.callbacks?.onNetworkStatusChange(true);
      }
    }, { allowSignalWrites: true });
  }

  // Metrics
  readonly tabSwitchCount = signal(0);
  readonly totalViolations = signal(0);
  readonly biometricSnapshotsCount = signal(0);
  readonly monitoringSnapshotsCount = signal(0);

  // Resolution
  readonly resolvedSessionId = signal<string | null>(null);
  readonly needsFullscreenReturn = signal(false);
  readonly needsFocusReturn = signal(false);

  // Biometric state
  readonly biometricValidating = signal(false);
  readonly biometricError = signal<string | null>(null);
  readonly biometricSuccess = signal(false);

  // Debug
  readonly logs = signal<{ time: string; type: 'info' | 'error' | 'success'; msg: string; details?: Record<string, unknown> }[]>([]);

  // Config (set on init)
  private config: SusieConfig | null = null;
  private callbacks: OrchestratorCallbacks | null = null;

  // Private
  private visibilityReturnHandler = this.onVisibilityReturn.bind(this);
  private preventGlobalContextMenu = this.handlePreventContextMenu.bind(this);
  private preventGlobalDevTools = this.handlePreventDevTools.bind(this);

  // --- Computed ---
  
  readonly computedSteps = computed(() => {
    if (!this.config) return [];
    const p = this.config.securityPolicies;
    const steps: { id: string; label: string }[] = [];

    if (p.requireConsent) steps.push({ id: 'CONSENT', label: 'Consentimiento' });
    if (p.requireBiometrics) steps.push({ id: 'BIOMETRIC_CHECK', label: 'Biometría' });
    if (p.requireEnvironmentCheck) steps.push({ id: 'ENVIRONMENT_CHECK', label: 'Verificación' });
    if (p.requireGazeTracking) steps.push({ id: 'GAZE_CALIBRATION', label: 'Calibración' });
    steps.push({ id: 'EXAM_BRIEFING', label: 'Preparación' });
    steps.push({ id: 'MONITORING', label: 'Examen' });

    return steps;
  });

  readonly stepsWithStatus = computed<StepInfo[]>(() => {
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

  readonly remainingTabSwitches = computed(() => {
    if (!this.config) return undefined;
    const max = this.config.maxTabSwitches;
    if (max === undefined) return undefined;
    return Math.max(0, max - this.tabSwitchCount());
  });

  // --- Initialization ---

  initialize(config: SusieConfig, callbacks: OrchestratorCallbacks): void {
    this.config = config;
    this.callbacks = callbacks;

    this.log('info', '🚀 ProctoringOrchestrator inicializado');

    // Configure services synchronously
    this.evidenceService.configure(config.apiUrl, config.authToken, config.sessionContext);
    this.evidenceService.setLogger((type, msg, details) => this.log(type, msg, details));
    this.securityService.setLogger((type, msg, details) => this.log(type, msg, details));
    this.inactivityService.configure(
      config.inactivityTimeoutMinutes ?? 3,
      config.onInactivityDetected
    );

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.cleanup.addEventListener(document, 'contextmenu', this.preventGlobalContextMenu as EventListener);
    this.cleanup.addEventListener(document, 'keydown', this.preventGlobalDevTools as EventListener);
  }

  private handlePreventContextMenu(e: Event): boolean {
    e.preventDefault();
    this.log('info', 'Click derecho deshabilitado globalmente.');
    return false;
  }

  private handlePreventDevTools(e: KeyboardEvent): void {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
      (e.ctrlKey && e.key === 'u')
    ) {
      e.preventDefault();
      this.log('error', '⚠️ Intento de abrir DevTools bloqueado globalmente.');
      if (this.state() === 'MONITORING') {
        this.handleViolation({
          type: 'INSPECTION_ATTEMPT',
          message: 'Intento de abrir DevTools por atajo',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // --- Flow Control ---

  async initializeFlow(): Promise<void> {
    if (!this.config) return;
    const policies = this.config.securityPolicies;

    const needsCamera = Boolean(policies.requireCamera || policies.requireBiometrics);

    if (needsCamera || policies.requireMicrophone) {
      this.setState('PERMISSION_PREP');
      return;
    }

    this.advanceAfterPermissions();
  }

  handlePermissionPrepared(): void {
    this.log('success', '🎥 Permisos listos');
    this.advanceAfterPermissions();
  }

  private advanceAfterPermissions(): void {
    if (!this.config) return;
    const policies = this.config.securityPolicies;

    if (policies.requireConsent) {
      this.setState('CONSENT');
    } else if (policies.requireEnvironmentCheck) {
      this.setState('ENVIRONMENT_CHECK');
    } else if (policies.requireGazeTracking) {
      this.setState('GAZE_CALIBRATION');
    } else {
      this.goToExamBriefing();
    }
  }

  handleConsent(result: ConsentResult): void {
    this.config?.onConsentResult?.(result);

    if (result.accepted) {
      this.log('success', '✅ Consentimiento aceptado');
      
      if (this.config?.securityPolicies.requireBiometrics) {
        this.setState('BIOMETRIC_CHECK');
      } else if (this.config?.securityPolicies.requireEnvironmentCheck) {
        this.setState('ENVIRONMENT_CHECK');
      } else {
        this.goToExamBriefing();
      }
    } else {
      this.log('error', '❌ Consentimiento rechazado');
    }
  }

  async handleBiometricCompleted(event: { photo: Blob }): Promise<void> {
    if (!this.config) return;
    
    this.log('success', '📸 Foto biométrica capturada');
    this.biometricValidating.set(true);
    this.biometricError.set(null);
    this.biometricSuccess.set(false);

    const userId = this.config.sessionContext?.userId || 'anonymous';
    
    // Use callback for validation (allows component to handle UI while service does the work)
    const isValid = await this.callbacks?.onBiometricValidationRequired(event.photo, userId) ?? false;

    this.biometricValidating.set(false);
    this.biometricSnapshotsCount.update(c => c + 1);

    if (!isValid) {
      this.log('error', '⚠️ Validación biométrica fallida');
      this.biometricError.set('La validación biométrica ha fallado. Revisa tu iluminación e intenta de nuevo.');
      return;
    }

    this.log('success', '✅ Validación biométrica exitosa');
    this.biometricSuccess.set(true);
  }

  handleBiometricSuccessConfirmed(): void {
    this.log('success', '👤 Identidad verificada');
    this.biometricSuccess.set(false);

    if (!this.config) return;

    if (this.config.securityPolicies.requireEnvironmentCheck) {
      this.setState('ENVIRONMENT_CHECK');
    } else if (this.config.securityPolicies.requireGazeTracking) {
      this.configureGazeService();
      this.setState('GAZE_CALIBRATION');
    } else {
      this.goToExamBriefing();
    }
  }

  handleBiometricRetake(): void {
    this.biometricError.set(null);
  }

  handleEnvironmentCheck(result: { passed: boolean }): void {
    if (result.passed) {
      this.log('success', '✅ Verificación de entorno exitosa');
      
      if (this.config?.securityPolicies.requireGazeTracking) {
        this.configureGazeService();
        this.setState('GAZE_CALIBRATION');
      } else {
        this.goToExamBriefing();
      }
    } else {
      this.log('error', '❌ Falló verificación de entorno');
    }
  }

  private configureGazeService(): void {
    this.gazeService.configure(
      {},
      (type, msg, details) => this.log(type, msg, details),
      () => this.handleGazeDeviation()
    );
  }

  handleGazeCalibrationCompleted(): void {
    this.log('success', '👁️ Calibración de gaze completada');
    this.goToExamBriefing();
  }

  private goToExamBriefing(): void {
    this.log('info', '📋 Mostrando briefing del examen');
    this.setState('EXAM_BRIEFING');
  }

  handleBriefingAcknowledged(): void {
    this.log('success', '✅ Briefing confirmado');
    this.startMonitoring();
  }

  // --- Monitoring Phase ---

  private async startMonitoring(): Promise<void> {
    if (!this.config) return;
    
    this.setState('MONITORING');
    const policies = this.config.securityPolicies;

    // Activate protections
    if (policies.requireFullscreen) {
      this.securityService.enterFullscreen();
    }

    this.securityService.enableProtection(policies, (violation) => {
      this.handleViolation(violation);
    });

    // Gaze setup if needed
    if (policies.requireGazeTracking && this.gazeService.isCalibrated()) {
      this.gazeService.configure(
        {},
        (type, msg, details) => this.log(type, msg, details),
        () => this.handleGazeDeviation()
      );
      this.log('info', '👁️ Gaze Tracking activo');
    }

    // Inactivity
    this.inactivityService.startMonitoring();

    // Visibility handler for fullscreen recovery
    if (policies.requireFullscreen) {
      this.cleanup.addEventListener(document, 'visibilitychange', this.visibilityReturnHandler);
    }

    // Start session with backend
    const realSessionId = await this.evidenceService.startSession();
    if (realSessionId) {
      this.resolvedSessionId.set(realSessionId);
      this.callbacks?.onSessionStarted(realSessionId);
    }

    // WebSocket feedback
    const apiUrl = this.config.apiUrl || '';
    const wsUrl = apiUrl.replace(/^http/, 'ws');
    const sessionId = realSessionId || this.config.sessionContext?.examSessionId || '';
    if (wsUrl && sessionId) {
      this.feedbackService.connect(wsUrl, sessionId);
    }

    this.log('info', '🛡️ Monitoreo activo iniciado');
  }

  private handleGazeDeviation(): void {
    this.handleViolation({
      type: 'GAZE_DEVIATION',
      message: 'La mirada se desvió fuera del área de la pantalla por un período prolongado',
      timestamp: new Date().toISOString()
    });
  }

  handleViolation(violation: SecurityViolation): void {
    this.totalViolations.update(c => c + 1);
    this.log('error', `🚨 Violación: ${violation.type}`);

    // Map to backend trigger
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

    this.evidenceService.sendEvent({
      type: 'BROWSER_EVENT',
      trigger: triggerMap[violation.type] || violation.type,
      browser_focus: document.hasFocus()
    } as any);

    // Tab switch logic
    if (violation.type === 'TAB_SWITCH' || violation.type === 'FOCUS_LOST') {
      const count = this.tabSwitchCount() + 1;
      this.tabSwitchCount.set(count);
      const max = this.config?.maxTabSwitches;

      if (max !== undefined && count >= max) {
        this.log('error', `❌ Límite de abandonos alcanzado (${count}/${max})`);
        this.callbacks?.onViolation(violation);
      } else {
        this.log('error', `⚠️ Abandono ${count}/${max ?? '∞'}`);
        if (violation.type === 'FOCUS_LOST') {
          this.needsFocusReturn.set(true);
        }
      }
    } else if (violation.type === 'FULLSCREEN_EXIT') {
      this.needsFullscreenReturn.set(true);
      this.log('error', '⚠️ Fullscreen perdido');
    } else {
      this.callbacks?.onViolation(violation);
    }
  }

  private onVisibilityReturn(): void {
    if (!document.hidden && this.config?.securityPolicies.requireFullscreen && !document.fullscreenElement) {
      this.needsFullscreenReturn.set(true);
    }
  }

  async returnToFullscreen(): Promise<void> {
    try {
      await this.securityService.enterFullscreen();
      this.needsFullscreenReturn.set(false);
      this.log('success', '✅ Fullscreen restaurado');
    } catch {
      this.log('error', '❌ No se pudo restaurar fullscreen');
    }
  }

  returnToFocus(): void {
    this.needsFocusReturn.set(false);
    this.log('success', '✅ Foco restaurado');
  }

  // --- Exam Completion ---

  handleExamFinished(result: ExamResult): void {
    this.log('success', '🏁 Examen finalizado');
    this.feedbackService.disconnect();
    this.evidenceService.endSession('submitted');

    const enrichedResult: ExamResult = {
      ...result,
      metadata: {
        ...result.metadata,
        sessionId: this.resolvedSessionId() ?? this.config?.sessionContext?.examSessionId,
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

    this.callbacks?.onExamFinished(enrichedResult);
  }

  // --- Helpers ---

  private setState(newState: ProctoringState): void {
    this.state.set(newState);
  }

  retryMedia(): void {
    this.mediaError.set(null);
    this.initializeFlow();
  }

  confirmActivity(): void {
    this.inactivityService.resetTimer();
  }

  dismissCriticalAlert(): void {
    this.feedbackService.currentAlert.set(null);
  }

  clearLogs(): void {
    this.logs.set([]);
  }

  private log(type: 'info' | 'error' | 'success', msg: string, details?: unknown): void {
    if (this.config?.debugMode) {
      this.logs.update(prev => [{
        time: new Date().toLocaleTimeString(),
        type,
        msg,
        details: details && typeof details === 'object' ? details as Record<string, unknown> : undefined
      }, ...prev]);
    }
    this.callbacks?.onLog(type, msg, details);
  }

  // --- Cleanup ---

  ngOnDestroy(): void {
    this.destroy();
  }

  destroy(): void {
    this.log('info', '🛑 Deteniendo orchestrator');

    this.cleanup.removeEventListener(document, 'contextmenu', this.preventGlobalContextMenu as EventListener);
    this.cleanup.removeEventListener(document, 'keydown', this.preventGlobalDevTools as EventListener);
    this.cleanup.removeEventListener(document, 'visibilitychange', this.visibilityReturnHandler as EventListener);

    if (this.state() === 'MONITORING') {
      this.evidenceService.endSession('cancelled');
    }

    this.feedbackService.disconnect();
    this.mediaService.stop();
    this.evidenceService.stopAudioRecording();
    this.securityService.disableProtection();
    this.gazeService.stop();
    this.inactivityService.stopMonitoring();
  }

  // --- Getters for component ---

  getMediaService(): MediaService { return this.mediaService; }
  getEvidenceService(): EvidenceService { return this.evidenceService; }
  getGazeService(): GazeTrackingService { return this.gazeService; }
}