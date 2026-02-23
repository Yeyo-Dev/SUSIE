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
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SusieConfig, SecurityViolation, EvidenceMetadata, EvidencePayload, SusieQuestion, ExamResult, ConsentResult } from '../../models/contracts';
import { MediaService } from '../../services/media.service';
import { EvidenceService } from '../../services/evidence.service';
import { SecurityService } from '../../services/security.service';
import { NetworkMonitorService } from '../../services/network-monitor.service';
import { InactivityService } from '../../services/inactivity.service';

// Child components
import { CameraPipComponent } from '../camera-pip/camera-pip.component';
import { ConsentDialogComponent } from '../consent-dialog/consent-dialog.component';
import { EnvironmentCheckComponent } from '../environment-check/environment-check.component';
import { BiometricOnboardingComponent } from '../biometric-onboarding/biometric-onboarding.component';
import { ExamEngineComponent } from '../exam-engine/exam-engine.component';
import { ElementRef, ViewChild } from '@angular/core';


/** Estado interno del flujo de proctoring */
type ProctoringState = 'CHECKING_PERMISSIONS' | 'CONSENT' | 'BIOMETRIC_CHECK' | 'ENVIRONMENT_CHECK' | 'MONITORING';


@Component({
  selector: 'susie-wrapper',
  standalone: true,
  imports: [
    CommonModule,
    CameraPipComponent,
    ConsentDialogComponent,
    ConsentDialogComponent,
    BiometricOnboardingComponent,
    EnvironmentCheckComponent,
    ExamEngineComponent
  ],

  templateUrl: './susie-wrapper.component.html',
  styleUrl: './susie-wrapper.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    MediaService,
    EvidenceService,
    SecurityService,
    NetworkMonitorService,
    InactivityService
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

  // --- State Signals ---
  state = signal<ProctoringState>('CHECKING_PERMISSIONS');
  mediaStream = this.mediaService.stream;
  mediaError = this.mediaService.error;
  isOnline = this.networkService.isOnline;
  inactivityWarning = this.inactivityService.showWarning; // Nuevo: warning signal
  private snapshotInterval: any = null;
  tabSwitchCount = signal(0);
  needsFullscreenReturn = signal(false);
  private visibilityReturnHandler = this.onVisibilityReturn.bind(this);

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
    await this.initializeFlow();
  }

  ngOnDestroy() {
    this.log('info', '🛑 Deteniendo SusieWrapper...');
    // Si se destruye el componente y la sesión estaba activa, notificar al servidor
    if (this.state() === 'MONITORING') {
      this.evidenceService.endSession('cancelled');
    }

    this.mediaService.stop();
    this.evidenceService.stopAudioRecording();
    this.stopSnapshotLoop();
    this.securityService.disableProtection();
    document.removeEventListener('visibilitychange', this.visibilityReturnHandler);
    this.inactivityService.stopMonitoring();
  }

  private async initializeFlow() {
    const policies = this.config().securityPolicies;

    // 1. Permisos de Media
    // Si requiere Biometría, IMPLÍCITAMENTE requiere cámara, aunque requireCamera sea false
    const needsCamera = Boolean(policies.requireCamera || policies.requireBiometrics);

    if (needsCamera || policies.requireMicrophone) {
      this.state.set('CHECKING_PERMISSIONS');
      try {
        await this.mediaService.requestPermissions(needsCamera, policies.requireMicrophone);
        this.log('success', '🎥 Permisos de media concedidos');
      } catch (err: any) {
        this.log('error', `❌ Error solicitando permisos: ${err.message}`);
        return; // Se queda en estado de error (UI manejada por template)
      }
    }


    // 2. Consentimiento
    if (policies.requireConsent) {
      this.state.set('CONSENT');
    } else if (policies.requireEnvironmentCheck) {
      this.state.set('ENVIRONMENT_CHECK');
    } else {
      this.startMonitoring();
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
        this.startMonitoring();
      }

    } else {
      this.log('error', '❌ Consentimiento rechazado por usuario');
      // El componente susie-consent-dialog maneja el estado de rechazo visualmente (botón reconsiderar)
    }
  }

  /**
   * Maneja el completado del onboarding biométrico.
   */
  handleBiometricCompleted(event: { photo: Blob }) {
    this.log('success', '📸 Foto biométrica capturada');

    // Enviar evidencia de referencia (Biometría)
    try {
      this.evidenceService.sendEvent({
        type: 'SNAPSHOT',
        browser_focus: document.hasFocus(),
        file: event.photo // Enviar la foto biométrica
      });
      this.log('info', '📤 Evidencia biométrica enviada');

    } catch (e) {
      this.log('error', '⚠️ Falló envío de evidencia biométrica', e);
    }

    // Avanzar flujo
    if (this.config().securityPolicies.requireEnvironmentCheck) {
      this.log('info', '🔜 Avanzando a Environment Check');
      this.state.set('ENVIRONMENT_CHECK');
    } else {
      this.log('info', '🔜 Iniciando Monitoreo');
      this.startMonitoring();
    }
  }

  /**
   * Maneja el resultado de la verificación de entorno.
   */
  handleEnvironmentCheck(result: { passed: boolean }) {

    if (result.passed) {
      this.log('success', '✅ Verificación de entorno exitosa');
      this.startMonitoring();
    } else {
      this.log('error', '❌ Falló verificación de entorno');
    }
  }

  /**
   * Inicia el monitoreo activo (Examen en curso).
   */
  private startMonitoring() {
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

    // Iniciar monitoreo de inactividad
    this.inactivityService.startMonitoring();

    // Registrar listener para recuperación de fullscreen al regresar a la pestaña
    if (policies.requireFullscreen) {
      document.addEventListener('visibilitychange', this.visibilityReturnHandler);
    }

    // Notificar al backend que inició la sesión
    this.evidenceService.startSession();

    this.log('info', '🛡️ Monitoreo activo iniciado');
  }


  private handleViolation(violation: SecurityViolation) {
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
    };

    // Enviar evento al backend con trigger específico
    this.evidenceService.sendEvent({
      type: 'BROWSER_EVENT',
      trigger: triggerMap[violation.type] || violation.type,
      browser_focus: document.hasFocus()
    } as any);

    // Lógica de maxTabSwitches: solo cancelar cuando se alcance el límite
    if (violation.type === 'TAB_SWITCH') {
      const count = this.tabSwitchCount() + 1;
      this.tabSwitchCount.set(count);
      const max = this.config().maxTabSwitches;

      if (max !== undefined && count >= max) {
        this.log('error', `❌ Límite de cambios de pestaña alcanzado (${count}/${max}). Cancelando examen.`);
        this.config().onSecurityViolation?.(violation);
      } else {
        this.log('error', `⚠️ Cambio de pestaña ${count}/${max ?? '∞'} — siguiente cancelará el examen`);
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
    this.evidenceService.endSession('submitted');
    this.config().onExamFinished?.(result);
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

  private startSnapshotLoop(intervalSeconds: number) {
    this.log('info', `📸 Iniciando snapshots automáticos cada ${intervalSeconds}s`);
    this.stopSnapshotLoop();

    // Attach stream to hidden video for capture
    setTimeout(() => {
      if (this.snapshotVideo && this.mediaStream()) {
        this.snapshotVideo.nativeElement.srcObject = this.mediaStream();
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
          this.evidenceService.sendEvent({
            type: 'SNAPSHOT',
            browser_focus: document.hasFocus(),
            file: blob
          });
          // Opcional: loguear cada snapshot puede ser ruidoso
          // this.log('info', '📸 Snapshot enviado');
        }
      }, 'image/jpeg', 0.6); // Calidad media
    }
  }
}

