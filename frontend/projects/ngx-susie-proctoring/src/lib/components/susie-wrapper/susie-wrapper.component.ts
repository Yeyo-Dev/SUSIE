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
import {
  PersistedSessionState,
  isSessionRecoverable,
  calculateRemainingTime
} from '@lib/models/session-storage.interface';

// Child components
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

  // --- Outputs ---
  readonly stateChange = output<ProctoringState>();

  // --- Services ---
  private readonly orchestrator = inject(ProctoringOrchestratorService);
  private readonly evidenceQueueService = inject(EvidenceQueueService);
  private readonly sessionStorage = inject(SessionStorageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // --- View Child ---
  @ViewChild('snapshotVideo') snapshotVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('examEngine') examEngine!: ExamEngineComponent;

  // --- Monitor Helper ---
  private monitorHelper: ProctoringMonitorHelper | null = null;

  // --- Recovery State ---
  showRecoveryModal = signal(false);
  recoveryState = signal<PersistedSessionState | null>(null);

  // --- Computed for recovery dialog ---
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

  // --- Exposed Signals (delegated to orchestrator) ---
  readonly state = this.orchestrator.state;
  readonly stepsWithStatus = this.orchestrator.stepsWithStatus;
  readonly mediaStream = this.orchestrator.mediaStream;
  readonly mediaError = this.orchestrator.mediaError;
  readonly isOnline = this.orchestrator.isOnline;
  readonly aiAlert = this.orchestrator.aiAlert;
  readonly inactivityWarning = this.orchestrator.inactivityWarning;
  
  // Evidence queue
  readonly pendingEvidencesCount = this.evidenceQueueService.pendingCount;
  
  readonly tabSwitchCount = this.orchestrator.tabSwitchCount;
  readonly remainingTabSwitches = this.orchestrator.remainingTabSwitches;
  readonly needsFullscreenReturn = this.orchestrator.needsFullscreenReturn;
  readonly needsFocusReturn = this.orchestrator.needsFocusReturn;
  
  // Biometric state
  readonly biometricValidating = this.orchestrator.biometricValidating;
  readonly biometricError = this.orchestrator.biometricError;
  readonly biometricSuccess = this.orchestrator.biometricSuccess;

  // Debug
  readonly logs = this.orchestrator.logs;

  // --- Private ---
  private beforeUnloadHandler = this.handleBeforeUnload.bind(this);

  constructor() {
    // Forward state changes to parent
    effect(() => {
      this.stateChange.emit(this.state());
    });

    // Configure monitor helper when state becomes MONITORING
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

    // Start snapshots
    if (policies.requireCamera && cfg.capture?.snapshotIntervalSeconds) {
      this.monitorHelper.startSnapshotLoop(cfg.capture.snapshotIntervalSeconds, this.mediaStream());
    }

    // Start gaze if calibrated
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
    
    const cfg = this.config();
    const sessionId = cfg.sessionContext.examSessionId;
    
    // Check for recoverable session BEFORE initializing orchestrator
    if (SessionStorageService.isAvailable()) {
      const existingSession = await this.sessionStorage.loadState(sessionId);
      
      if (existingSession && isSessionRecoverable(existingSession, sessionId, cfg.sessionContext.durationMinutes)) {
        this.recoveryState.set(existingSession);
        this.showRecoveryModal.set(true);
        return; // Wait for user decision
      } else if (existingSession) {
        // Stale/expired session — clear silently
        await this.sessionStorage.clearState(existingSession.examSessionId);
        this.log('info', '🗑️ Sesión stale limpiada');
      }
    }
    
    // No recovery needed — proceed with normal init
    await this.initializeFresh();
  }

  private async initializeFresh(): Promise<void> {
    this.orchestrator.initialize(this.config(), {
      onStateChange: (state) => {
        // State changes handled via signal
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
        // Could emit to parent if needed
      },
      onInactivityWarning: () => {
        // Handled by inactivityWarning signal
      },
      onNetworkStatusChange: (isOnline) => {
        // Could emit to parent
      }
    });

    await this.orchestrator.initializeFlow();
    
    // Setup persistence effect
    this.setupPersistenceEffect();
  }

  private async initializeWithRecovery(state: PersistedSessionState): Promise<void> {
    const cfg = this.config();
    
    // Initialize orchestrator with recovered state
    const recoveryState: RecoveryState = {
      proctoringState: state.proctoringState,
      totalViolations: state.totalViolations,
      tabSwitchCount: state.tabSwitchCount,
      remoteSessionId: state.remoteSessionId,
    };
    
    this.orchestrator.initialize(cfg, {
      onStateChange: (s) => {},
      onViolation: (v) => { cfg.onSecurityViolation?.(v); },
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
    
    // Setup persistence effect
    this.setupPersistenceEffect();
  }

  // --- Recovery Handlers ---

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

  // --- Persistence Effect ---

  private setupPersistenceEffect(): void {
    // Only persist when in MONITORING state
    effect(() => {
      const currentState = this.state();
      if (currentState !== 'MONITORING') return;
      
      const sessionId = this.config().sessionContext.examSessionId;
      
      // Build state object
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
    
    // beforeunload handler for immediate save on tab close
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
      
      // Synchronous save attempt (best effort)
      this.sessionStorage.saveState(state);
    }
  }

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.monitorHelper?.destroy();
    this.orchestrator.destroy();
  }

  // --- Child Component Handlers (delegates to orchestrator) ---

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
    // Clear session state on completion
    const sessionId = this.config().sessionContext.examSessionId;
    this.sessionStorage.clearState(sessionId);
    
    this.orchestrator.handleExamFinished(result);
  }

  // --- User Actions (delegates to orchestrator) ---

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

  // --- Debug Helper ---

  log(type: 'info' | 'error' | 'success' | 'warn', msg: string, details?: unknown) {
    if (this.config().debugMode) {
      // Logs handled by orchestrator
    }
  }
}