import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GazeTrackingService } from '../../services/gaze';

@Component({
  selector: 'susie-face-loss-countdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './face-loss-countdown.component.html',
  styleUrl: './face-loss-countdown.component.css'
})
export class SusieFaceLossCountdownComponent {
  protected gazeService = inject(GazeTrackingService);
}
