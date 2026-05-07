import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, output, input, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaService } from '@lib/services/media.service';
import { StepInfo } from '@lib/models/contracts';
import { StepIndicatorComponent } from '@lib/components/step-indicator/step-indicator.component';

@Component({
    selector: 'susie-biometric-onboarding',
    standalone: true,
    imports: [CommonModule, StepIndicatorComponent],
    templateUrl: './biometric-onboarding.component.html',
    styleUrl: './biometric-onboarding.component.css'
})
export class BiometricOnboardingComponent implements AfterViewInit, OnDestroy {
    // Outputs
    completed = output<{ photo: Blob }>();
    retakeRequested = output<void>();
    successConfirmed = output<void>();

    /** Pasos dinámicos del indicador (recibidos del wrapper) */
    steps = input<StepInfo[]>([]);

    /** Estado de validación inyectado desde el wrapper */
    isValidating = input<boolean>(false);
    validationError = input<string | null>(null);
    /** Cuando el wrapper confirma éxito, el componente muestra el feedback */
    validationSuccess = input<boolean>(false);

    /** Pantalla de éxito: deriva directo del input (sin effect) */
    readonly showSuccess = computed(() => this.validationSuccess());

    // Acceso al elemento de video
    @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

    // Estado interno
    showCard = true;
    capturedImage = signal<string | null>(null);
    private capturedBlob: Blob | null = null;

    private mediaService = inject(MediaService);
    private stream: MediaStream | null = null;

    constructor() {
        effect(() => {
            if (this.validationSuccess()) {
                // Esperar a que termine la animación antes de continuar
                setTimeout(() => {
                    this.successConfirmed.emit();
                }, 2000);
            }
        });
    }

    async ngAfterViewInit() {
        await this.startCamera();
    }

    ngOnDestroy() {
        // Solo detener las pistas específicas que podríamos haber creado si es necesario,
        // pero usualmente MediaService maneja el stream global.
        // Sin embargo, para este componente queremos asegurar que la lógica del elemento de video esté limpia.
        // NO detenemos el stream de MediaService aquí porque podría necesitarse para el examen más tarde.
    }

    async startCamera() {
        // Reutilizar el stream existente de MediaService si está disponible
        this.stream = this.mediaService.stream();

        if (this.stream && this.videoElement) {
            const videoEl = this.videoElement.nativeElement;
            videoEl.srcObject = this.stream;
            // Forzar muted imperativo para evitar eco de audio
            videoEl.muted = true;
            videoEl.volume = 0;
        }
    }

    capturePhoto() {
        if (!this.videoElement?.nativeElement) return;

        const video = this.videoElement.nativeElement;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Dibujar frame al canvas
            // Mirror si es necesario (CSS transforms solo afecta visual, canvas necesita transform explícito si queremos salida espejada)
            // Usualmente para biometría queremos imagen RAW (no espejada), pero la vista previa está espejada.
            // Capturemos RAW.
            ctx.drawImage(video, 0, 0);

            // Convertir a DataURL para la vista previa
            this.capturedImage.set(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality

            // Convertir a Blob para subir
            canvas.toBlob(blob => {
                this.capturedBlob = blob;
            }, 'image/jpeg', 0.8);
        }
    }

    retakePhoto() {
        this.capturedImage.set(null);
        this.capturedBlob = null;
        this.retakeRequested.emit();
        // Readjuntar el stream al elemento de video en el siguiente tick
        setTimeout(() => this.startCamera(), 0);
    }

    confirmPhoto() {
        if (this.capturedBlob) {
            this.completed.emit({ photo: this.capturedBlob });
        }
    }
}
