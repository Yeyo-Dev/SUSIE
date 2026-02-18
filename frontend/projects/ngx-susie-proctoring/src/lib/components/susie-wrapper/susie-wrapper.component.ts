import {
  Component, ChangeDetectionStrategy, input, OnInit, OnDestroy,
  inject, viewChild, ElementRef, effect, signal, computed,
} from '@angular/core';
import { MediaService } from '../../services/media.service';
import { EvidenceService } from '../../services/evidence.service';
import { SecurityService } from '../../services/security.service';
import { SusieConfig, EvidencePayload, SecurityViolation, ConsentResult } from '../../models/contracts';
import { ConsentDialogComponent } from '../consent-dialog/consent-dialog.component';
import { interval, Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'susie-wrapper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConsentDialogComponent, DatePipe],
  template: `
    <div class="susie-container">
      <!-- PASO 1: Consentimiento (si aplica) -->
      @if (needsConsent() && consentStatus() !== 'accepted') {
        <susie-consent-dialog
          [config]="config()"
          (consentGiven)="onConsentResult($event)" />
      } @else {
        <!-- PASO 2: Contenido del examen (solo tras aceptar consentimiento) -->
        <div class="susie-content">
          <ng-content />
        </div>

        <!-- Overlay de error de permisos -->
        @if (mediaService.error()) {
          <div class="media-error-backdrop" role="alert" aria-live="assertive">
            <div class="media-error-card">
              <div class="media-error-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16.5 2.25V6a.75.75 0 0 0 1.28.53l2.72-2.72"/>
                  <path d="M22.5 7.5V18a3 3 0 0 1-3 3H4.5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3H15"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </div>
              <h2 class="media-error-title">Permisos de dispositivo requeridos</h2>
              <p class="media-error-message">{{ mediaService.error() }}</p>
              <p class="media-error-detail">Este examen requiere acceso a tu cámara y/o micrófono para la supervisión. Por favor, permite el acceso cuando tu navegador lo solicite.</p>
              <button
                type="button"
                class="media-error-retry"
                (click)="retryMedia()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Reintentar permisos
              </button>
            </div>
          </div>
        }

        <!-- Panel de Debug (solo para pruebas) -->
        @if (config().debugMode) {
          <div class="debug-panel">
            <div class="debug-header">
              <strong>🔍 Debug Panel</strong>
              <button (click)="clearDebugLogs()" class="clear-btn">Limpiar</button>
            </div>
            <div class="debug-content">
              @for (log of debugLogs(); track log.timestamp) {
                <div class="debug-log" [class]="log.type">
                  <span class="timestamp">{{ log.timestamp | date:'HH:mm:ss' }}</span>
                  <span class="icon">{{ log.icon }}</span>
                  <span class="message">{{ log.message }}</span>
                  @if (log.details) {
                    <div class="details">{{ log.details }}</div>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- Componente PIP (Picture-in-Picture) simulado -->
        <div class="susie-pip" [class.hidden]="!mediaService.isActive()">
          <video #userVideo autoplay playsinline muted></video>
          <div class="recording-indicator">
            <span class="dot"></span>
            REC @if (mediaService.audioRecordingActive()) { 🎤 }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .susie-container {
      position: relative;
      width: 100%;
      height: 100vh;
      overflow-y: auto;
      overflow-x: hidden;
      background: #f4f4f4;
    }

    .susie-content {
      width: 100%;
      min-height: 100%;
      z-index: 1;
    }

    .debug-panel {
      position: fixed;
      top: 20px;
      left: 20px;
      width: 400px;
      max-height: 300px;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #00ff00;
      border-radius: 8px;
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      z-index: 9999;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
    }

    .debug-header {
      background: #1a1a1a;
      padding: 8px 12px;
      border-bottom: 1px solid #00ff00;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .clear-btn {
      background: #00ff00;
      color: #000;
      border: none;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-weight: bold;
    }

    .clear-btn:hover {
      background: #00cc00;
    }

    .debug-content {
      max-height: 250px;
      overflow-y: auto;
      padding: 8px;
    }

    .debug-log {
      padding: 6px;
      margin-bottom: 4px;
      border-left: 3px solid #00ff00;
      background: rgba(0, 255, 0, 0.05);
    }

    .debug-log.error {
      border-left-color: #ff0000;
      color: #ff6666;
    }

    .debug-log.success {
      border-left-color: #00ff00;
      color: #00ff00;
    }

    .timestamp {
      color: #888;
      margin-right: 8px;
    }

    .icon {
      margin-right: 6px;
    }

    .message {
      font-weight: bold;
    }

    .details {
      margin-top: 4px;
      padding-left: 60px;
      color: #aaa;
      font-size: 10px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .susie-pip {
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 200px;
      height: 112px;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      border: 2px solid #fff;
    }

    .susie-pip.hidden {
      display: none;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }

    .recording-indicator {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .dot {
      width: 6px;
      height: 6px;
      background-color: red;
      border-radius: 50%;
      animation: blink 1s infinite;
    }

    @keyframes blink {
      0% { opacity: 1; }
      50% { opacity: 0.3; }
      100% { opacity: 1; }
    }

    /* --- Error de permisos de media --- */
    .media-error-backdrop {
      position: fixed;
      inset: 0;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9000;
      padding: 1rem;
    }

    .media-error-card {
      background: #ffffff;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.05);
      animation: card-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes card-enter {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .media-error-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      background: #fef2f2;
      border-radius: 50%;
      color: #dc2626;
      margin-bottom: 1.5rem;
    }

    .media-error-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.5rem;
      line-height: 1.3;
    }

    .media-error-message {
      font-size: 0.875rem;
      color: #dc2626;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin: 0 0 1rem;
      line-height: 1.5;
    }

    .media-error-detail {
      font-size: 0.8125rem;
      color: #64748b;
      line-height: 1.6;
      margin: 0 0 1.5rem;
    }

    .media-error-retry {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
    }

    .media-error-retry:hover {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }

    .media-error-retry:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }
  `],
})
export class SusieWrapperComponent implements OnInit, OnDestroy {
  /** Configuración completa del examen pasada por la app host (Chaindrenciales). */
  config = input.required<SusieConfig>();

  // Inyección de dependencias
  readonly mediaService = inject(MediaService);
  private readonly evidenceService = inject(EvidenceService);
  private readonly securityService = inject(SecurityService);

  // Referencia al elemento de video en el template
  videoElement = viewChild<ElementRef<HTMLVideoElement>>('userVideo');

  private snapshotSubscription?: Subscription;

  // Contadores de eventos de comportamiento para AI
  private keyboardEventCount = 0;
  private tabSwitchCount = 0;

  // --- Estado de consentimiento ---
  /** Determina si el examen necesita mostrar consentimiento. */
  needsConsent = computed(() => {
    const policies = this.config().securityPolicies;
    // Si requireConsent está explícitamente definido, usarlo.
    // Si no, inferir de los permisos de hardware.
    if (policies.requireConsent !== undefined) {
      return policies.requireConsent;
    }
    return policies.requireCamera || policies.requireMicrophone;
  });

  /** Estado del consentimiento: pending, accepted, rejected. */
  consentStatus = signal<'pending' | 'accepted' | 'rejected'>('pending');

  /** Resultado del consentimiento para reporting. */
  consentResult = signal<ConsentResult | null>(null);

  // Debug logs (solo para pruebas)
  private debugLogsSignal = signal<Array<{
    timestamp: Date;
    type: 'success' | 'error';
    icon: string;
    message: string;
    details?: string;
  }>>([]);
  readonly debugLogs = this.debugLogsSignal.asReadonly();

  constructor() {
    // Efecto síncrono para asignar el stream al elemento de video cuando esté disponible
    // IMPORTANTE: Solo asignamos las pistas de VIDEO para evitar feedback de audio
    effect(() => {
      const stream = this.mediaService.stream();
      const videoEl = this.videoElement()?.nativeElement;
      if (stream && videoEl) {
        // Crear un nuevo stream solo con las pistas de video
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoOnlyStream = new MediaStream(videoTracks);
          videoEl.srcObject = videoOnlyStream;
        }
      }
    });
  }

  /** Maneja el resultado del consentimiento. Si acepta, inicializa proctoring. */
  onConsentResult(result: ConsentResult): void {
    this.consentResult.set(result);

    if (result.accepted) {
      this.consentStatus.set('accepted');
      // Inicializar proctoring ahora que tenemos consentimiento
      this.initializeProctoring();
    } else {
      this.consentStatus.set('rejected');
    }

    // Notificar a la app host
    this.config().onConsentResult?.(result);
  }

  private addDebugLog(type: 'success' | 'error', icon: string, message: string, details?: string): void {
    const logs = this.debugLogsSignal();
    const newLog = {
      timestamp: new Date(),
      type,
      icon,
      message,
      details,
    };

    // Mantener solo los últimos 5 logs
    const updatedLogs = [newLog, ...logs].slice(0, 5);
    this.debugLogsSignal.set(updatedLogs);
  }

  clearDebugLogs(): void {
    this.debugLogsSignal.set([]);
  }

  async ngOnInit(): Promise<void> {
    const cfg = this.config();
    if (!cfg) {
      console.error('SusieWrapper: Configuración requerida no provista.');
      return;
    }

    // Inicializar servicios que no dependen de consentimiento
    this.evidenceService.setConfig(cfg);
    this.securityService.initialize(
      cfg.securityPolicies,
      (violation: SecurityViolation) => this.handleSecurityViolation(violation),
    );

    // Si NO necesita consentimiento, inicializar proctoring directamente
    if (!this.needsConsent()) {
      this.consentStatus.set('accepted');
      await this.initializeProctoring();
    }
  }

  /** Inicializa cámara, audio, tracking y snapshots — solo tras consentimiento. */
  private async initializeProctoring(): Promise<void> {
    const cfg = this.config();

    // Determinar si necesitamos audio
    const needsAudio = cfg.securityPolicies.requireMicrophone ||
      cfg.audioConfig?.enabled;

    // Iniciar cámara/micrófono si las políticas lo requieren
    if (cfg.securityPolicies.requireCamera || needsAudio) {
      await this.mediaService.startStream(
        cfg.securityPolicies.requireCamera,
        needsAudio,
      );
    }

    // Iniciar grabación de audio si está habilitado
    if (needsAudio) {
      await this.startAudioRecording();
    }

    // Configurar tracking de eventos de comportamiento para AI
    this.setupBehavioralTracking();

    // Iniciar snapshots periódicos si la cámara está habilitada
    if (cfg.securityPolicies.requireCamera) {
      this.startMonitoringCycle();
    }
  }

  private setupBehavioralTracking(): void {
    // Trackear eventos de teclado
    document.addEventListener('keydown', () => {
      this.keyboardEventCount++;
    });

    // Trackear cambios de pestaña (pérdida de foco)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.tabSwitchCount++;
        console.log(`⚠️ Tab switch detectado (total: ${this.tabSwitchCount})`);
      }
    });
  }

  ngOnDestroy(): void {
    this.securityService.destroy();
    this.mediaService.stopAudioRecording();
    this.mediaService.stopStream();
    this.snapshotSubscription?.unsubscribe();
  }

  retryMedia(): void {
    const cfg = this.config();
    const needsAudio = cfg.securityPolicies.requireMicrophone ||
      cfg.audioConfig?.enabled;

    this.mediaService.startStream(
      cfg.securityPolicies.requireCamera,
      needsAudio,
    );
  }

  private async startAudioRecording(): Promise<void> {
    try {
      // Intervalo de chunks configurable — default 10s es equilibrio entre latencia y carga de red
      const chunkIntervalSeconds = this.config().audioConfig?.chunkIntervalSeconds ?? 10;
      const chunkIntervalMs = chunkIntervalSeconds * 1000;

      await this.mediaService.startAudioRecording(
        (audioBlob) => this.sendAudioChunk(audioBlob),
        chunkIntervalMs,
      );

      console.log(`✅ Grabación de audio iniciada (chunks cada ${chunkIntervalSeconds}s)`);
    } catch (error) {
      console.error('❌ Error al iniciar grabación de audio:', error);
    }
  }

  private sendAudioChunk(audioBlob: Blob): void {
    const cfg = this.config();
    const payload: EvidencePayload = {
      metadata: {
        meta: {
          correlation_id: cfg.sessionContext.examSessionId,
          exam_id: cfg.sessionContext.examId,
          student_id: 'STUDENT_ID_PLACEHOLDER', // TODO: Obtener del authToken JWT
          timestamp: new Date().toISOString(),
          source: 'frontend_client_v1',
        },
        payload: {
          type: 'AUDIO_CHUNK',
          browser_focus: document.hasFocus(),
          keyboard_events: this.keyboardEventCount,
          tab_switches: this.tabSwitchCount,
        },
      },
      file: audioBlob,
    };

    this.evidenceService.sendEvidence(payload).subscribe({
      next: (response) => {
        console.log('🎤 Audio chunk enviado correctamente');
        console.log('📦 Respuesta del backend:', response);

        this.addDebugLog(
          'success',
          '🎤',
          'Audio chunk enviado',
          `URL: ${response.data?.file_url}\nTamaño: ${response.data?.file_size} bytes\nStatus: ${response.status}`,
        );
      },
      error: (err: unknown) => {
        console.error('❌ Error enviando audio chunk:', err);

        this.addDebugLog(
          'error',
          '❌',
          'Error enviando audio',
          err instanceof Error ? err.message : 'Error desconocido',
        );
      },
    });
  }

  private startMonitoringCycle(): void {
    // Ciclo de snapshots cada 30s — frecuencia balanceada para supervisión sin saturar el almacenamiento
    this.snapshotSubscription = interval(30000).subscribe(async () => {
      const videoEl = this.videoElement()?.nativeElement;
      if (videoEl && this.mediaService.isActive()) {
        const blob = await this.mediaService.takeSnapshot(videoEl);

        if (blob) {
          this.sendSnapshot(blob);
        }
      }
    });
  }

  private sendSnapshot(imageBlob: Blob): void {
    const cfg = this.config();
    // El Blob del snapshot se envía junto con metadata JSON en el mismo FormData
    // El backend separa ambos y almacena el archivo en Azure Blob Storage
    const payload: EvidencePayload = {
      metadata: {
        meta: {
          correlation_id: cfg.sessionContext.examSessionId,
          exam_id: cfg.sessionContext.examId,
          student_id: 'STUDENT_ID_PLACEHOLDER', // TODO: Obtener del authToken JWT
          timestamp: new Date().toISOString(),
          source: 'frontend_client_v1',
        },
        payload: {
          type: 'SNAPSHOT',
          browser_focus: document.hasFocus(),
          keyboard_events: this.keyboardEventCount,
          tab_switches: this.tabSwitchCount,
        },
      },
      file: imageBlob,
    };

    this.evidenceService.sendEvidence(payload).subscribe({
      next: (response) => {
        console.log('📸 Snapshot enviado correctamente');
        console.log('📦 Respuesta del backend:', response);
        console.log('🔗 URL simulada:', response.data?.file_url);
        console.log('📊 Tamaño:', response.data?.file_size, 'bytes');
      },
      error: (err: unknown) => {
        console.error('❌ Error enviando snapshot:', err);
      },
    });
  }

  private handleSecurityViolation(violation: SecurityViolation): void {
    this.addDebugLog(
      'error',
      '🚨',
      `Violación: ${violation.type}`,
      violation.message,
    );

    // Reenviar a la app host — permite que el componente padre (ej: AppComponent) reaccione cancelando el examen
    this.config().onSecurityViolation?.(violation);
  }
}
