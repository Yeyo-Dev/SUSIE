import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepInfo, SusieConfig } from '../../models/contracts';
import { MediaService } from '../../services/media.service';
import { StepIndicatorComponent } from '../step-indicator/step-indicator.component';

/** Estados internos del PermissionPrepComponent */
type PermissionPrepState = 'preparing' | 'requesting' | 'granted' | 'denied';

/** Tipo para las políticas de seguridad (extraído de SusieConfig) */
type SecurityPolicies = SusieConfig['securityPolicies'];

@Component({
  selector: 'susie-permission-prep',
  standalone: true,
  imports: [CommonModule, StepIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permission-prep.component.html',
  styleUrl: './permission-prep.component.css'
})
export class PermissionPrepComponent {
  /** Políticas de seguridad para determinar qué permisos mostrar */
  policies = input<SecurityPolicies>({
    requireCamera: true,
    requireMicrophone: true,
    requireConsent: false,
    requireBiometrics: false,
    requireEnvironmentCheck: false,
    requireFullscreen: false,
    requireGazeTracking: false
  });

  /** Pasos para el indicador de progreso */
  steps = input<StepInfo[]>([]);

  /** Emitido cuando el usuario confirma el preview y los permisos están listos */
  permissionPrepared = output<void>();

  /** Emitido cuando se van a solicitar los permisos */
  permissionRequested = output<void>();

  private mediaService = inject(MediaService);

  @ViewChild('previewVideo') previewVideo!: ElementRef<HTMLVideoElement>;

  /** Estado interno del componente */
  readonly state = signal<PermissionPrepState>('preparing');

  /** Si hay un error de permisos */
  readonly hasError = signal(false);

  /** Mensaje de error */
  readonly errorMessage = signal<string | null>(null);

  /** Determina si mostrar el preview de cámara */
  readonly showPreview = computed(() => 
    this.state() === 'granted' && 
    this.mediaService.stream() !== null
  );

  /** Determina qué iconos mostrar según las políticas */
  readonly showCamera = computed(() => this.policies().requireCamera ?? true);
  readonly showMic = computed(() => this.policies().requireMicrophone ?? true);

  constructor() {
    // Sincronizar el stream del MediaService con el elemento de video
    effect(() => {
      const stream = this.mediaService.stream();
      if (stream && this.previewVideo?.nativeElement) {
        const videoEl = this.previewVideo.nativeElement;
        videoEl.srcObject = stream;
        videoEl.play().catch(() => {
          // Ignore autoplay errors
        });
      }
    }, { allowSignalWrites: true });

    // Observar errores del MediaService usando effect
    effect(() => {
      const error = this.mediaService.error();
      if (error) {
        this.errorMessage.set(error);
        this.hasError.set(true);
        this.state.set('denied');
      }
    }, { allowSignalWrites: true });
  }

  /** Maneja el clic en el botón principal */
  async onContinue() {
    if (this.state() === 'preparing') {
      this.requestPermissions();
    } else if (this.state() === 'granted') {
      this.permissionPrepared.emit();
    } else if (this.state() === 'denied') {
      // Reset y reintentar
      this.hasError.set(false);
      this.errorMessage.set(null);
      this.state.set('preparing');
    }
  }

  /** Solicita los permisos al navegador */
  private async requestPermissions() {
    this.state.set('requesting');
    this.permissionRequested.emit();

    const needsCamera = this.policies().requireCamera ?? true;
    const needsMic = this.policies().requireMicrophone ?? true;

    try {
      await this.mediaService.requestPermissions(needsCamera, needsMic);
      // Permisos concedidos - el effect se encarga de mostrar el preview
      this.state.set('granted');
    } catch (err: any) {
      // Permisos denegados o error
      this.errorMessage.set(err.message ?? 'Permiso denegado');
      this.hasError.set(true);
      this.state.set('denied');
    }
  }

  /** Texto para el botón principal según el estado */
  readonly buttonText = computed(() => {
    switch (this.state()) {
      case 'preparing':
        return 'Continuar';
      case 'requesting':
        return 'Solicitando permisos...';
      case 'granted':
        return 'Comenzar Examen';
      case 'denied':
        return 'Intentar de nuevo';
    }
  });

  /** Si el botón está deshabilitado */
  readonly isButtonDisabled = computed(() => 
    this.state() === 'requesting'
  );
}
