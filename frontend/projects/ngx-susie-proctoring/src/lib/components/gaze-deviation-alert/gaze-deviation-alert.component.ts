import { Component, inject, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GazeTrackingService } from '../../services/gaze';

/**
 * GazeDeviationAlert - Muestra alertas cuando hay desviación de mirada
 *
 * Se muestra cuando el usuario mira fuera del área permitida por más de 2 segundos.
 */
@Component({
  selector: 'susie-gaze-deviation-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <div class="deviation-alert" [class.warning]="isWarning()" [class.error]="!isWarning()">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <span class="alert-title">{{ title() }}</span>
          @if (message()) {
            <span class="alert-message">{{ message() }}</span>
          }
        </div>
        <div class="alert-counter">
          Desviaciones: {{ totalDeviations() }}
        </div>
      </div>
    }
  `,
  styles: [`
    .deviation-alert {
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10001;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: slide-down 0.3s ease;
      max-width: 400px;
    }

    .deviation-alert.warning {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border: 2px solid #fbbf24;
    }

    .deviation-alert.error {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border: 2px solid #f87171;
    }

    .alert-icon {
      font-size: 1.5rem;
    }

    .alert-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .alert-title {
      font-weight: 600;
      color: white;
      font-size: 0.9rem;
    }

    .alert-message {
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.75rem;
    }

    .alert-counter {
      background: rgba(0, 0, 0, 0.2);
      padding: 4px 8px;
      border-radius: 4px;
      color: white;
      font-size: 0.7rem;
      font-weight: 500;
    }

    @keyframes slide-down {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `]
})
export class GazeDeviationAlertComponent {
  private readonly gazeService = inject(GazeTrackingService);

  /** Mensaje personalizado (opcional) */
  readonly message = input<string | null>(null);

  /** Título de la alerta */
  readonly title = input<string>('⚠️ Alerta de Mirada');

  /** Mostrar contador de desviaciones */
  readonly showCounter = input<boolean>(true);

  /** Severidad de la alerta */
  readonly severity = input<'warning' | 'error'>('warning');

  readonly isDeviating = computed(() => this.gazeService.isDeviating());
  readonly totalDeviations = computed(() => this.gazeService.totalDeviations());

  readonly isVisible = computed(() => this.isDeviating());

  isWarning = computed(() => this.severity() === 'warning');
}
