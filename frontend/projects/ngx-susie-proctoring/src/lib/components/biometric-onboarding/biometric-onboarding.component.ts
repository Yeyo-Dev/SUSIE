import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaService } from '../../services/media.service';

@Component({
    selector: 'susie-biometric-onboarding',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './biometric-onboarding.component.html',
    styleUrl: './biometric-onboarding.component.css'
})
export class BiometricOnboardingComponent implements AfterViewInit, OnDestroy {
    // Outputs
    completed = output<{ photo: Blob }>();

    // Access to video element
    @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

    // Internal state
    showCard = true;
    capturedImage = signal<string | null>(null);
    private capturedBlob: Blob | null = null;

    private mediaService = inject(MediaService);
    private stream: MediaStream | null = null;

    async ngAfterViewInit() {
        await this.startCamera();
    }

    ngOnDestroy() {
        // Only stop the specific tracks we might have created if needed, 
        // but usually MediaService manages the global stream.
        // However, for this component we want to ensure the video element logic is clean.
        // We DON'T stop the MediaService stream here because it might be needed for the exam later.
    }

    async startCamera() {
        // Re-use the existing stream from MediaService if available
        this.stream = this.mediaService.stream();

        if (this.stream && this.videoElement) {
            this.videoElement.nativeElement.srcObject = this.stream;
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
            // Draw frame to canvas
            // Mirroring if needed (CSS transforms visual only, canvas needs explicit transform if we want mirrored output)
            // Usually for biometrics we want RAW image (not mirrored), but preview is mirrored.
            // Let's capture RAW.
            ctx.drawImage(video, 0, 0);

            // Convert to DataURL for preview
            this.capturedImage.set(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality

            // Convert to Blob for upload
            canvas.toBlob(blob => {
                this.capturedBlob = blob;
            }, 'image/jpeg', 0.8);
        }
    }

    retakePhoto() {
        this.capturedImage.set(null);
        this.capturedBlob = null;
        // Re-attach stream to video element on next tick
        setTimeout(() => this.startCamera(), 0);
    }

    confirmPhoto() {
        if (this.capturedBlob) {
            this.completed.emit({ photo: this.capturedBlob });
        }
    }
}
