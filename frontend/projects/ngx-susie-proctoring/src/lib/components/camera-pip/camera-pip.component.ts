import { Component, input, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'susie-camera-pip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pip-container">
      <video #pipVideo autoplay playsinline [muted]="muted()"></video>
      <div class="status-indicator">
        <span class="recording-dot"></span> REC
      </div>
    </div>
  `,
  styles: [`
    .pip-container {
      position: relative;
      width: 100%; height: 100%;
      background: #000; overflow: hidden;
      border-radius: inherit;
    }
    video {
      width: 100%; height: 100%;
      object-fit: cover; transform: scaleX(-1);
    }
    .status-indicator {
      position: absolute; top: 8px; left: 8px;
      display: flex; align-items: center; gap: 4px;
      background: rgba(0,0,0,0.6); padding: 2px 6px;
      border-radius: 4px; color: white; font-size: 10px;
    }
    .recording-dot {
      width: 6px; height: 6px; background-color: #ef4444;
      border-radius: 50%; animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  `]
})
export class CameraPipComponent {
  stream = input.required<MediaStream>();
  muted = input(true);

  @ViewChild('pipVideo') pipVideo!: ElementRef<HTMLVideoElement>;

  constructor() {
    effect(() => {
      const s = this.stream();
      if (this.pipVideo && this.pipVideo.nativeElement && s) {
        const videoEl = this.pipVideo.nativeElement;
        videoEl.srcObject = s;
        // Forzar muted imperativo — Angular [muted] binding no siempre
        // aplica el atributo HTML correctamente en todos los navegadores
        videoEl.muted = true;
        videoEl.volume = 0;
      }
    });
  }
}
