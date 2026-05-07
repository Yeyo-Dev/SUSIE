import {
  Component,
  input,
  output,
  effect,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  DestroyRef,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  SusieConfig, 
  SusieQuestion, 
  ExamResult,
  ConsentResult,
  LoggerFn
} from '@lib/models/contracts';
import { ProctoringOrchestratorService, ProctoringState, RecoveryState } from '@lib/services/proctoring-orchestrator.service';
import { ProctoringMonitorHelper } from '@lib/helpers/proctoring-monitor.helper';
import { EvidenceQueueService } from '@lib/services/evidence-queue.service';
import { SessionStorageService } from '@lib/services/session-storage.service';
import { AuthTokenService } from '@lib/services/auth-token.service';
import {
  PersistedSessionState,
  isSessionRecoverable,
  calculateRemainingTime
} from '@lib/models/session-storage.interface';

// Componentes hijos
import { CameraPipComponent } from '@lib/components/camera-pip/camera-pip.component';
import { ConsentDialogComponent } from '@lib/components/consent-dialog/consent-dialog.component';
import { EnvironmentCheckComponent } from '@lib/components/environment-check/environment-check.component';
import { BiometricOnboardingComponent } from '@lib/components/biometric-onboarding/biometric-onboarding.component';
import { ExamEngineComponent } from '@lib/components/exam-engine/exam-engine.component';
import { GazeCalibrationComponent } from '@lib/components/gaze-calibration/gaze-calibration.component';
import { ExamBriefingComponent } from '@lib/components/exam-briefing/exam-briefing.component';
import { StepIndicatorComponent } from '@lib/components/step-indicator/step-indicator.component';
import { PermissionPrepComponent } from '@lib/components/permission-prep/permission-prep.component';
import { SusieFaceLossCountdownComponent } from '@lib/components/face-loss-countdown/face-loss-countdown.component';


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
    PermissionPrepComponent,
    SusieFaceLossCountdownComponent
  ],

  templateUrl: './susie-wrapper.component.html',
  styleUrl: './susie-wrapper.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SusieWrapperComponent {
  // --- Inputs ---
  readonly config = input.required<SusieConfig>();
  readonly questions = input<SusieQuestion[]>([]);
  
  /** URL base del API (opcional, sobrescribe config.apiUrl) */
  readonly apiUrl = input<string>('');
  
  /** Token de autenticación (opcional, sobrescribe config.authToken) */
  readonly token = input<string>('');

  // --- Outputs ---
  readonly stateChange = output<ProctoringState>();

  // --- Servicios ---
  private readonly orchestrator = inject(ProctoringOrchestratorService);
  private readonly evidenceQueueService = inject(EvidenceQueueService);
  private readonly sessionStorage = inject(SessionStorageService);
  private readonly tokenService = inject(AuthTokenService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // --- ViewChild ---
  @ViewChild('snapshotVideo') snapshotVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('examEngine') examEngine!: ExamEngineComponent;

  // --- Helper de Monitoreo ---
  private monitorHelper: ProctoringMonitorHelper | null = null;

  // --- Estado de Recuperación ---
  showRecoveryModal = signal(false);
  recoveryState = signal<PersistedSessionState | null>(null);

  // --- Computados para diálogo de recuperación ---
  recoverySummary = computed(() => {
    const state = this.recoveryState();
    if (!state) return null;
    
    const cfg = this.config();
    const answeredCount = Object.keys(state.answers).length;
    const remainingSeconds = calculateRemainingTime(state, cfg.sessionContext.durationMinutes);
    
    return {
      answeredCount,
      remainingMinutes: Math.floor(remainingSeconds / 60),
      remainingSeconds: remainingSeconds % 60,
    };
  });

  // --- Signals expuestos (delegados al orchestrator) ---
  readonly state = this.orchestrator.state;
  readonly stepsWithStatus = this.orchestrator.stepsWithStatus;
  readonly mediaStream = this.orchestrator.mediaStream;
  readonly mediaError = this.orchestrator.mediaError;
  readonly isOnline = this.orchestrator.isOnline;
  readonly aiAlert = this.orchestrator.aiAlert;
  readonly inactivityWarning = this.orchestrator.inactivityWarning;
  
  // Cola de evidencias
  readonly pendingEvidencesCount = this.evidenceQueueService.pendingCount;
  
  readonly tabSwitchCount = this.orchestrator.tabSwitchCount;
  readonly remainingTabSwitches = this.orchestrator.remainingTabSwitches;
  readonly needsFullscreenReturn = this.orchestrator.needsFullscreenReturn;
  readonly needsFocusReturn = this.orchestrator.needsFocusReturn;
  
  // Estado biométrico
  readonly biometricValidating = this.orchestrator.biometricValidating;
  readonly biometricError = this.orchestrator.biometricError;
  readonly biometricSuccess = this.orchestrator.biometricSuccess;

  // Debug
  readonly logs = this.orchestrator.logs;

  // --- Privado ---
  private beforeUnloadHandler = this.handleBeforeUnload.bind(this);

  constructor() {
    // Reenviar cambios de estado al padre
    effect(() => {
      this.stateChange.emit(this.state());
    });

    // Configurar helper de monitoreo cuando el estado es MONITORING
    effect(() => {
      const currentState = this.state();
      if (currentState === 'MONITORING' && !this.monitorHelper) {
        this.setupMonitoring();
      }
    }, { allowSignalWrites: true });
  }

  private setupMonitoring(): void {
    if (!this.snapshotVideo) return;

    const cfg = this.config();
    const policies = cfg.securityPolicies;

    this.monitorHelper = new ProctoringMonitorHelper(
      this.orchestrator.getEvidenceService(),
      this.orchestrator.getGazeService(),
      this.orchestrator.getMediaService(),
      () => this.orchestrator.totalViolations.update(c => c + 1),
      (type, msg) => this.log(type, msg)
    );

    this.monitorHelper.setVideoRef(this.snapshotVideo);

    // Iniciar capturas
    if (policies.requireCamera && cfg.capture?.snapshotIntervalSeconds) {
      this.monitorHelper.startSnapshotLoop(cfg.capture.snapshotIntervalSeconds, this.mediaStream());
    }

    // Iniciar gaze si está calibrado
    if (policies.requireGazeTracking && this.orchestrator.getGazeService().gazeState() === 'TRACKING') {
      this.monitorHelper.startGazeLoop();
    }
  }

  async ngOnInit() {
    // Configurar logger de persistencia
    this.sessionStorage.setLogger((type, msg, details) => this.log(type, msg, details));
    
    if (!SessionStorageService.isAvailable()) {
      this.log('warn', '⚠️ IndexedDB no disponible — recuperación deshabilitada');
    }
    
    // Sincronizar token y URL con el TokenService (para interceptors HTTP)
    const token = this.token() || this.config().authToken;
    const apiUrl = this.apiUrl() || this.config().apiUrl;
    
    if (token) {
      this.tokenService.setToken(token);
    }
    if (apiUrl) {
      this.tokenService.setApiUrl(apiUrl);
    }
    
    const cfg = this.config();
    const sessionId = cfg.sessionContext.examSessionId;
    
    // Verificar sesión recuperable ANTES de inicializar orchestrator
    if (SessionStorageService.isAvailable()) {
      const existingSession = await this.sessionStorage.loadState(sessionId);
      
      if (existingSession && isSessionRecoverable(existingSession, sessionId, cfg.sessionContext.durationMinutes)) {
        this.recoveryState.set(existingSession);
        this.showRecoveryModal.set(true);
        return; // Esperar decisión del usuario
      } else if (existingSession) {
        // Sesión stale/expirada — limpiar silenciosamente
        await this.sessionStorage.clearState(existingSession.examSessionId);
        this.log('info', '🗑️ Sesión stale limpiada');
      }
    }
    
    // Sin recuperación necesaria — proceder con inicialización normal
    await this.initializeFresh();
  }

  private async initializeFresh(): Promise<void> {
    // Preferir inputs sobre config para apiUrl y authToken
    const effectiveApiUrl = this.apiUrl() || this.config().apiUrl;
    const effectiveToken = this.token() || this.config().authToken;
    
    // Crear config efectiva con los valores correctos
    const effectiveConfig: SusieConfig = {
      ...this.config(),
      apiUrl: effectiveApiUrl,
      authToken: effectiveToken
    };
    
    this.orchestrator.initialize(effectiveConfig, {
      onStateChange: (state) => {
        // Cambios de estado manejados via signal
      },
      onViolation: (violation) => {
        this.config().onSecurityViolation?.(violation);
      },
      onExamFinished: (result) => {
        this.handleExamFinished(result);
      },
      onLog: (type, msg, details) => {
        this.log(type, msg, details);
      },
      onBiometricValidationRequired: async (photo, userId) => {
        return await this.orchestrator.getEvidenceService().validateBiometric(photo, userId);
      },
      onSessionStarted: (sessionId) => {
        // Podría emitir al padre si es necesario
      },
      onInactivityWarning: () => {
        // Manejado por signal inactivityWarning
      },
      onNetworkStatusChange: (isOnline) => {
        // Podría emitir al padre
      }
    });

    await this.orchestrator.initializeFlow();
    
    // Configurar efecto de persistencia
    this.setupPersistenceEffect();
  }

  private async initializeWithRecovery(state: PersistedSessionState): Promise<void> {
    // Preferir inputs sobre config para apiUrl y authToken
    const effectiveApiUrl = this.apiUrl() || this.config().apiUrl;
    const effectiveToken = this.token() || this.config().authToken;
    
    // Crear config efectiva con los valores correctos
    const effectiveConfig: SusieConfig = {
      ...this.config(),
      apiUrl: effectiveApiUrl,
      authToken: effectiveToken
    };
    
    // Inicializar orchestrator con estado recuperado
    const recoveryState: RecoveryState = {
      proctoringState: state.proctoringState,
      totalViolations: state.totalViolations,
      tabSwitchCount: state.tabSwitchCount,
      remoteSessionId: state.remoteSessionId,
    };
    
    this.orchestrator.initialize(effectiveConfig, {
      onStateChange: (s) => {},
      onViolation: (v) => { effectiveConfig.onSecurityViolation?.(v); },
      onExamFinished: (r) => { this.handleExamFinished(r); },
      onLog: (type, msg, details) => { this.log(type, msg, details); },
      onBiometricValidationRequired: async (photo, userId) => {
        return await this.orchestrator.getEvidenceService().validateBiometric(photo, userId);
      },
      onSessionStarted: (sessionId) => {},
      onInactivityWarning: () => {},
      onNetworkStatusChange: (isOnline) => {}
    }, recoveryState);

    await this.orchestrator.initializeFlow();
    
    // Configurar efecto de persistencia
    this.setupPersistenceEffect();
  }

  // --- Handlers de Recuperación ---

  async handleRecoveryContinue(): Promise<void> {
    this.showRecoveryModal.set(false);
    const state = this.recoveryState();
    if (!state) return;
    
    await this.initializeWithRecovery(state);
  }

  async handleRecoveryStartFresh(): Promise<void> {
    this.showRecoveryModal.set(false);
    const state = this.recoveryState();
    if (state) {
      await this.sessionStorage.clearState(state.examSessionId);
    }
    await this.initializeFresh();
  }

  // --- Efecto de Persistencia ---

  private setupPersistenceEffect(): void {
    // Solo persistir cuando está en estado MONITORING
    effect(() => {
      const currentState = this.state();
      if (currentState !== 'MONITORING') return;
      
      const sessionId = this.config().sessionContext.examSessionId;
      
      // Construir objeto de estado
      const examState = this.examEngine?.extractState(sessionId);
      const proctoringState = this.orchestrator.extractState();
      
      if (examState && proctoringState) {
        const state: PersistedSessionState = {
          ...examState,
          ...proctoringState,
          examSessionId: sessionId,
          examId: this.config().sessionContext.examId,
          examStartedAt: examState.examStartedAt,
        } as PersistedSessionState;
        
        this.sessionStorage.saveState(state);
      }
    }, { allowSignalWrites: true });
    
    // handler beforeunload para guardado inmediato al cerrar pestaña
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private handleBeforeUnload(): void {
    const sessionId = this.config().sessionContext.examSessionId;
    const examState = this.examEngine?.extractState(sessionId);
    const proctoringState = this.orchestrator.extractState();
    
    if (examState && proctoringState) {
      const state: PersistedSessionState = {
        ...examState,
        ...proctoringState,
        examSessionId: sessionId,
        examId: this.config().sessionContext.examId,
      } as PersistedSessionState;
      
      // Intento de guardado síncrono (best effort)
      this.sessionStorage.saveState(state);
    }
  }

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.monitorHelper?.destroy();
    this.orchestrator.destroy();
    this.tokenService.clear();
  }

  // --- Handlers de Componentes Hijos (delegan al orchestrator) ---

  handlePermissionPrepared() {
    this.orchestrator.handlePermissionPrepared();
  }

  handleConsent(result: ConsentResult) {
    this.orchestrator.handleConsent(result);
  }

  async handleBiometricCompleted(event: { photo: Blob }) {
    await this.orchestrator.handleBiometricCompleted(event);
  }

  handleBiometricSuccessConfirmed() {
    this.orchestrator.handleBiometricSuccessConfirmed();
  }

  handleBiometricRetake() {
    this.orchestrator.handleBiometricRetake();
  }

  handleEnvironmentCheck(result: { passed: boolean }) {
    this.orchestrator.handleEnvironmentCheck(result);
  }

  handleGazeCalibrationCompleted() {
    this.orchestrator.handleGazeCalibrationCompleted();
  }

  handleBriefingAcknowledged() {
    this.orchestrator.handleBriefingAcknowledged();
  }

  handleExamFinished(result: ExamResult) {
    // Limpiar estado de sesión al completar
    const sessionId = this.config().sessionContext.examSessionId;
    this.sessionStorage.clearState(sessionId);
    
    this.orchestrator.handleExamFinished(result);
  }

  // --- Acciones de Usuario (delegan al orchestrator) ---

  async returnToFullscreen() {
    await this.orchestrator.returnToFullscreen();
  }

  returnToFocus() {
    this.orchestrator.returnToFocus();
  }

  retryMedia() {
    this.orchestrator.retryMedia();
  }

  confirmActivity() {
    this.orchestrator.confirmActivity();
  }

  dismissCriticalAlert() {
    this.orchestrator.dismissCriticalAlert();
  }

  clearLogs() {
    this.orchestrator.clearLogs();
  }

  // --- Helper de Debug ---

  log(type: 'info' | 'error' | 'success' | 'warn', msg: string, details?: unknown) {
    if (this.config().debugMode) {
      // Logs manejados por orchestrator
    }
  }
}