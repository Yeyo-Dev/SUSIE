import {
  Component,
  signal,
  input,
  output,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GazeTrackingService } from '../../services/gaze-tracking.service';
import { StepIndicatorComponent } from '../step-indicator/step-indicator.component';
import { StepInfo } from '../../models/contracts';

interface CalibrationPoint {
  id: number;
  top: string;
  left: string;
  clicks: number;
  completed: boolean;
}

const REQUIRED_CLICKS = 5;

@Component({
  selector: 'susie-gaze-calibration',
  standalone: true,
  imports: [CommonModule, StepIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="calibration-container">
      <!-- Indicador de pasos dinámico (posicionado arriba) -->
      @if (steps().length > 0) {
        <div class="calibration-steps">
          <susie-step-indicator [steps]="steps()" />
        </div>
      }
      <!-- Instrucciones -->
      <div class="calibration-header">
        <div class="calibration-icon">👁️</div>
        <h2>Calibración de Seguimiento Ocular</h2>
        <p>
          Haz clic <strong>{{ requiredClicks }} veces</strong> en cada punto rojo
          mientras lo miras fijamente. No muevas la cabeza.
        </p>
        <div class="progress-bar">
          <div class="progress-fill"
               [style.width.%]="(completedCount() / totalPoints) * 100">
          </div>
        </div>
        <span class="progress-label">
          {{ completedCount() }} / {{ totalPoints }} puntos calibrados
        </span>
      </div>

      <!-- Puntos de calibración -->
      @for (point of points(); track point.id) {
        <button
          class="calibration-point"
          [class.completed]="point.completed"
          [class.active]="point.clicks > 0 && !point.completed"
          [style.top]="point.top"
          [style.left]="point.left"
          [disabled]="point.completed"
          (click)="onPointClick(point)"
          [attr.aria-label]="'Punto de calibración ' + point.id">
          @if (point.completed) {
            <span class="check">✓</span>
          } @else if (point.clicks > 0) {
            <span class="click-count">{{ point.clicks }}</span>
          }
        </button>
      }

      <!-- Botón de finalizar (cuando todos los puntos están completos) -->
      @if (allCompleted()) {
        <div class="calibration-done">
          <div class="done-icon">✅</div>
          <h3>¡Calibración completada!</h3>
          <p>El seguimiento ocular está listo. Puedes continuar al examen.</p>
          <button class="continue-btn" (click)="finishCalibration()">
            Continuar al Examen →
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .calibration-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      overflow: hidden;
      z-index: 9999;
    }

    .calibration-steps {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 15;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
    }

    .calibration-header {
      position: absolute;
      top: 30%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #e2e8f0;
      z-index: 10;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      padding: 1.25rem 2rem;
      border-radius: 1rem;
      border: 1px solid rgba(148, 163, 184, 0.15);
      max-width: 360px;
    }

    .calibration-icon {
      font-size: 1.75rem;
      margin-bottom: 0.375rem;
    }

    .calibration-header h2 {
      margin: 0 0 0.375rem;
      font-size: 1rem;
      font-weight: 600;
      color: #f1f5f9;
    }

    .calibration-header p {
      margin: 0 0 0.75rem;
      font-size: 0.75rem;
      color: #94a3b8;
      line-height: 1.4;
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background: rgba(148, 163, 184, 0.2);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      border-radius: 3px;
      transition: width 0.4s ease;
    }

    .progress-label {
      font-size: 0.75rem;
      color: #64748b;
    }

    .calibration-point {
      position: absolute;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2px solid rgba(239, 68, 68, 0.6);
      background: radial-gradient(circle, #ef4444 40%, rgba(239, 68, 68, 0.4) 100%);
      cursor: pointer;
      transform: translate(-50%, -50%);
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      box-shadow: 0 0 16px rgba(239, 68, 68, 0.4);
      animation: pulse-glow 2s ease-in-out infinite;
    }

    .calibration-point:hover:not(.completed) {
      transform: translate(-50%, -50%) scale(1.2);
      box-shadow: 0 0 24px rgba(239, 68, 68, 0.6);
    }

    .calibration-point.active {
      background: radial-gradient(circle, #f59e0b 40%, rgba(245, 158, 11, 0.4) 100%);
      border-color: rgba(245, 158, 11, 0.6);
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.4);
      animation: none;
    }

    .calibration-point.completed {
      background: radial-gradient(circle, #22c55e 40%, rgba(34, 197, 94, 0.4) 100%);
      border-color: rgba(34, 197, 94, 0.6);
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.3);
      cursor: default;
      animation: none;
    }

    .click-count {
      color: white;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .check {
      color: white;
      font-size: 1rem;
      font-weight: 700;
    }

    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 16px rgba(239, 68, 68, 0.4); }
      50% { box-shadow: 0 0 28px rgba(239, 68, 68, 0.7); }
    }

    .calibration-done {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      z-index: 30;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      padding: 2.5rem 3rem;
      border-radius: 1rem;
      border: 1px solid rgba(34, 197, 94, 0.3);
      animation: fade-in 0.5s ease;
    }

    .done-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .calibration-done h3 {
      color: #f1f5f9;
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
    }

    .calibration-done p {
      color: #94a3b8;
      margin: 0 0 1.5rem;
      font-size: 0.875rem;
    }

    .continue-btn {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .continue-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
    }

    @keyframes fade-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
  `]
})
export class GazeCalibrationComponent implements OnInit, OnDestroy {
  /** Emite cuando la calibración finaliza exitosamente */
  calibrationCompleted = output<void>();

  /** Pasos dinámicos del indicador (recibidos del wrapper) */
  steps = input<StepInfo[]>([]);

  /** Stream existente de la cámara (para compartir con WebGazer) */
  stream = input<MediaStream | null>(null);

  private gazeService = inject(GazeTrackingService);

  readonly requiredClicks = REQUIRED_CLICKS;
  readonly totalPoints = 9;

  /** 9 puntos de calibración distribuidos en una grilla 3x3 */
  points = signal<CalibrationPoint[]>([
    { id: 1, top: '10%', left: '10%', clicks: 0, completed: false },
    { id: 2, top: '10%', left: '50%', clicks: 0, completed: false },
    { id: 3, top: '10%', left: '90%', clicks: 0, completed: false },
    { id: 4, top: '50%', left: '10%', clicks: 0, completed: false },
    { id: 5, top: '50%', left: '50%', clicks: 0, completed: false },
    { id: 6, top: '50%', left: '90%', clicks: 0, completed: false },
    { id: 7, top: '90%', left: '10%', clicks: 0, completed: false },
    { id: 8, top: '90%', left: '50%', clicks: 0, completed: false },
    { id: 9, top: '90%', left: '90%', clicks: 0, completed: false },
  ]);

  completedCount = signal(0);
  allCompleted = signal(false);

  async ngOnInit() {
    await this.gazeService.startCalibration(this.stream());
  }

  ngOnDestroy() {
    // No detenemos el servicio aquí — queremos que siga trackeando después de calibrar
  }

  onPointClick(point: CalibrationPoint) {
    if (point.completed) return;

    // Registrar click para WebGazer
    this.gazeService.recordCalibrationClick(
      this.getAbsoluteX(point.left),
      this.getAbsoluteY(point.top)
    );

    // Actualizar el estado del punto
    this.points.update(pts => pts.map(p => {
      if (p.id !== point.id) return p;
      const newClicks = p.clicks + 1;
      const nowCompleted = newClicks >= REQUIRED_CLICKS;
      return { ...p, clicks: newClicks, completed: nowCompleted };
    }));

    // Actualizar contadores
    const completed = this.points().filter(p => p.completed).length;
    this.completedCount.set(completed);

    if (completed === this.totalPoints) {
      this.allCompleted.set(true);
    }
  }

  finishCalibration() {
    this.gazeService.completeCalibration();
    this.calibrationCompleted.emit();
  }

  /** Convierte porcentaje CSS a píxeles absolutos */
  private getAbsoluteX(left: string): number {
    return (parseFloat(left) / 100) * window.innerWidth;
  }

  private getAbsoluteY(top: string): number {
    return (parseFloat(top) / 100) * window.innerHeight;
  }
}
