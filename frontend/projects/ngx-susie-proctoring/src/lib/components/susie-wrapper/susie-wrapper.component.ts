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
  DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  SusieConfig, 
  SusieQuestion, 
  ExamResult 
} from '../../models/contracts';
import { ProctoringOrchestratorService, ProctoringState } from '../../services/proctoring-orchestrator.service';
import { ProctoringMonitorHelper } from '../../helpers/proctoring-monitor.helper';
import { EvidenceQueueService } from '../../services/evidence-queue.service';

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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // --- View Child ---
  @ViewChild('snapshotVideo') snapshotVideo!: ElementRef<HTMLVideoElement>;

  // --- Monitor Helper ---
  private monitorHelper: ProctoringMonitorHelper | null = null;

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

  constructor() {
    // Forward state changes to parent (OutputEmitterRef has subscribe method)
    this.orchestrator.stateChange.subscribe((state: ProctoringState) => {
      this.stateChange.emit(state);
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

    // Start audio if configured
    if (policies.requireMicrophone && cfg.audioConfig?.enabled) {
      const audioStream = this.orchestrator.getMediaService().getAudioStream();
      if (audioStream) {
        this.orchestrator.getEvidenceService().startAudioRecording(audioStream, cfg.audioConfig);
      }
    }

    // Start gaze if calibrated
    if (policies.requireGazeTracking && this.orchestrator.getGazeService().isCalibrated()) {
      this.monitorHelper.startGazeLoop();
    }
  }

  async ngOnInit() {
    // Initialize orchestrator with config and callbacks
    this.orchestrator.initialize(this.config(), {
      onStateChange: (state) => {
        // State changes handled via signal
      },
      onViolation: (violation) => {
        this.config().onSecurityViolation?.(violation);
      },
      onExamFinished: (result) => {
        this.config().onExamFinished?.(result);
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
  }

  ngOnDestroy() {
    this.monitorHelper?.destroy();
    this.orchestrator.destroy();
  }

  // --- Child Component Handlers (delegates to orchestrator) ---

  handlePermissionPrepared() {
    this.orchestrator.handlePermissionPrepared();
  }

  handleConsent(result: any) {
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

  log(type: 'info' | 'error' | 'success', msg: string, details?: any) {
    if (this.config().debugMode) {
      // Logs handled by orchestrator
    }
  }
}