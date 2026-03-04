import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StepInfo } from '../../models/contracts';

/**
 * Indicador de pasos dinámico compartido (modo solo puntos).
 * Renderiza los pasos activos del flujo de proctoring como dots + líneas conectoras.
 */
@Component({
  selector: 'susie-step-indicator',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step-indicator" [attr.aria-label]="'Paso ' + currentIndex() + ' de ' + steps().length">
      @for (step of steps(); track step.id; let last = $last) {
        <div class="step-dot"
             [class.current]="step.status === 'current'"
             [class.completed]="step.status === 'completed'"
             [title]="step.label">
          @if (step.status === 'completed') {
            <svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        </div>
        @if (!last) {
          <div class="step-line" [class.filled]="step.status === 'completed'"></div>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .step-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem 1.5rem 0.75rem;
    }

    .step-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #cbd5e1;
      border: 2px solid #cbd5e1;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      cursor: default;
    }

    .step-dot.current {
      width: 12px;
      height: 12px;
      background: #10B981;
      border-color: #10B981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    }

    .step-dot.completed {
      background: #10B981;
      border-color: #10B981;
      color: white;
    }

    .step-line {
      width: 28px;
      height: 2px;
      background: #e2e8f0;
      margin: 0 4px;
      border-radius: 1px;
      transition: background 0.3s ease;
      flex-shrink: 0;
    }

    .step-line.filled {
      background: #10B981;
    }

    @media (max-width: 640px) {
      .step-indicator {
        padding: 0.75rem 1rem 0.5rem;
      }

      .step-line {
        width: 20px;
        margin: 0 3px;
      }
    }
  `]
})
export class StepIndicatorComponent {
  steps = input.required<StepInfo[]>();

  currentIndex() {
    const idx = this.steps().findIndex(s => s.status === 'current');
    return idx >= 0 ? idx + 1 : this.steps().length;
  }
}
