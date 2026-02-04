import { Component, Input, ViewChild, ElementRef, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaService } from '../../services/media.service';

@Component({
    selector: 'susie-camera-pip',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="pip-container" [class.hidden]="!mediaService.isActive()">
      <video #pipVideo autoplay playsinline muted></video>
      <div class="status-indicator">
        <span class="recording-dot"></span> Grabo
      </div>
    </div>
  `,
    styles: [`
    .pip-container {
      position: relative;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }

    .status-indicator {
      position: absolute;
      top: 5px;
      left: 5px;
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(0,0,0,0.5);
      padding: 2px 5px;
      border-radius: 4px;
      color: white;
      font-size: 0.7rem;
    }

    .recording-dot {
      width: 8px;
      height: 8px;
      background-color: #ff3b30;
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1); }
    }
  `]
})
export class CameraPipComponent {
    public mediaService = inject(MediaService);

    @ViewChild('pipVideo') pipVideo!: ElementRef<HTMLVideoElement>;

    constructor() {
        effect(() => {
            const stream = this.mediaService.stream();
            if (this.pipVideo && this.pipVideo.nativeElement && stream) {
                this.pipVideo.nativeElement.srcObject = stream;
            }
        });
    }
}
