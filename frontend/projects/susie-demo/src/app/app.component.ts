import { Component, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { SusieWrapperComponent, SusieConfig, SecurityViolation, ConsentResult } from 'ngx-susie-proctoring';

interface ExamQuestion {
  id: number;
  content: string;
  options: string[];
  correctAnswer: string;
}

type ExamState = 'taking' | 'submitted' | 'cancelled';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SusieWrapperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <susie-wrapper [config]="examConfig">
      <div class="exam-shell">
        <!-- TAKING EXAM -->
        @if (examState() === 'taking') {
          <div class="exam-container">
            <div class="exam-layout">

              <!-- Sidebar -->
              <aside class="exam-sidebar">
                <div class="sidebar-section">
                  <div class="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>Instrucciones</h3>
                  </div>
                  <ul class="instruction-list" role="list">
                    <li><strong>⚠️ No actualices la página</strong></li>
                    <li><strong>⚠️ No minimices la ventana</strong></li>
                    <li><strong>⚠️ No cambies de pestaña</strong></li>
                    <li><strong>⚠️ No salgas de pantalla completa</strong></li>
                    <li><strong>⚠️ No uses clic derecho o F12</strong></li>
                  </ul>
                  <p class="warning-text">
                    Cualquier intento de salir cancelará automáticamente el examen.
                  </p>
                </div>

                <!-- Timer -->
                <div class="sidebar-section">
                  <div class="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <h3>Temporizador</h3>
                  </div>
                  <div class="timer-display">
                    <div class="timer-value">{{ timerFormatted() }}</div>
                    <div class="timer-progress">
                      <div class="progress-bar" [style.width.%]="timerPercent()"></div>
                    </div>
                    <p class="timer-hint">Se enviará automáticamente al llegar a 0</p>
                  </div>
                </div>
              </aside>

              <!-- Main Content -->
              <main class="exam-content">
                <div class="exam-header">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                  </svg>
                  <h1>Examen de Certificación Angular <span>— Demo SUSIE</span></h1>
                </div>

                <div class="question-list">
                  @for (q of questions; track q.id; let i = $index) {
                    <div class="question-card">
                      <div class="question-content">
                        <p><span class="question-number">{{ i + 1 }}.</span> {{ q.content }}</p>
                      </div>
                      <fieldset class="options-list">
                        <legend class="sr-only">Opciones para pregunta {{ i + 1 }}</legend>
                        @for (opt of q.options; track opt) {
                          <label class="option-item">
                            <input
                              type="radio"
                              [name]="'q' + q.id"
                              [value]="opt"
                              [checked]="answers()[q.id] === opt"
                              (change)="selectAnswer(q.id, opt)" />
                            <span class="option-checkmark"></span>
                            <span class="option-text">{{ opt }}</span>
                          </label>
                        }
                      </fieldset>
                    </div>
                  }
                </div>

                <div class="exam-actions">
                  <button class="btn-submit" (click)="submitExam()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    Enviar examen
                  </button>
                </div>
              </main>

            </div>
          </div>
        }

        <!-- RESULTS -->
        @if (examState() === 'submitted') {
          <div class="results-container">
            <div class="results-card">
              <div class="results-header">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <h2>Resultado de la prueba</h2>
              </div>
              <div class="results-content">
                <div class="results-grid">
                  <div class="result-item">
                    <div class="result-icon">⭐</div>
                    <div class="result-details">
                      <h3>Puntos conseguidos</h3>
                      <p>{{ score() }}</p>
                    </div>
                  </div>
                  <div class="result-item">
                    <div class="result-icon">✅</div>
                    <div class="result-details">
                      <h3>Respuestas correctas</h3>
                      <p>{{ correctCount() }} / {{ questions.length }}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="results-actions">
                <button class="btn-home" (click)="resetExam()">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  Reiniciar Demo
                </button>
              </div>
            </div>
          </div>
        }

        <!-- CANCELLED -->
        @if (examState() === 'cancelled') {
          <div class="results-container">
            <div class="results-card cancelled">
              <div class="results-header cancelled-header">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <h2>Examen cancelado</h2>
              </div>
              <div class="results-content">
                <p class="cancellation-reason">{{ cancellationReason() }}</p>
                <p class="cancellation-info">Tu examen ha sido cancelado automáticamente por violación de las reglas de seguridad.</p>
              </div>
              <div class="results-actions">
                <button class="btn-home" (click)="resetExam()">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  Reiniciar Demo
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </susie-wrapper>
  `,
  styles: [`
    /* ─── Design Tokens ─── */
    :host {
      /* Brand */
      --brand: #0070f3;
      --brand-hover: #005cd1;
      --brand-subtle: #e8f4ff;
      --brand-glow: rgba(0, 112, 243, 0.12);

      /* Semantic */
      --success: #16a34a;
      --success-subtle: #f0fdf4;
      --warning: #f59e0b;
      --warning-subtle: #fffbeb;
      --danger: #dc2626;
      --danger-subtle: #fef2f2;

      /* Surfaces */
      --surface-0: #f8fafc;
      --surface-1: #ffffff;
      --surface-2: #f1f5f9;
      --surface-3: #e2e8f0;

      /* Ink (text hierarchy) */
      --ink-primary: #0f172a;
      --ink-secondary: #475569;
      --ink-muted: #94a3b8;
      --ink-inverse: #ffffff;

      /* Borders */
      --border-subtle: #e2e8f0;
      --border-default: #cbd5e1;
      --border-focus: var(--brand);

      /* Elevation */
      --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);

      /* Radii */
      --radius-sm: 6px;
      --radius: 10px;
      --radius-lg: 14px;

      /* Typography */
      --font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: "JetBrains Mono", "Fira Code", monospace;

      /* Transitions */
      --ease: cubic-bezier(0.4, 0, 0.2, 1);
      --duration: 150ms;
    }

    /* ─── Utilities ─── */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ─── Shell ─── */
    .exam-shell {
      font-family: var(--font);
      color: var(--ink-primary);
      min-height: 100vh;
      background: var(--surface-0);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ─── Layout ─── */
    .exam-container {
      max-width: 1320px;
      margin: 0 auto;
      padding: 1.5rem;
      user-select: none;
    }

    .exam-layout {
      display: flex;
      gap: 2rem;
      align-items: flex-start;
    }

    .exam-sidebar {
      width: 300px;
      flex-shrink: 0;
      position: sticky;
      top: 1.5rem;
    }

    .exam-content {
      flex: 1;
      min-width: 0;
    }

    /* ─── Sidebar Sections ─── */
    .sidebar-section {
      background: var(--surface-1);
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-subtle);
      margin-bottom: 1.25rem;
      overflow: hidden;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.875rem 1.125rem;
      background: var(--surface-2);
      border-bottom: 1px solid var(--border-subtle);
    }

    .section-header svg {
      color: var(--brand);
      flex-shrink: 0;
    }

    .section-header h3 {
      font-size: 0.9375rem;
      font-weight: 600;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .instruction-list {
      list-style: none;
      padding: 0.5rem 0;
      margin: 0;
    }

    .instruction-list li {
      padding: 0.5rem 1.125rem;
      font-size: 0.8125rem;
      color: var(--ink-secondary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: background var(--duration) var(--ease);
    }

    .instruction-list li:hover {
      background: var(--surface-2);
    }

    .instruction-list li strong {
      color: var(--danger);
      font-weight: 500;
    }

    .warning-text {
      font-size: 0.8125rem;
      background: var(--danger-subtle);
      color: var(--danger);
      padding: 0.75rem 1rem;
      margin: 0.5rem 0.75rem 0.75rem;
      border-radius: var(--radius-sm);
      font-weight: 600;
      border-left: 3px solid var(--danger);
      text-align: center;
      line-height: 1.5;
    }

    /* ─── Timer ─── */
    .timer-display {
      padding: 1.25rem;
      text-align: center;
    }

    .timer-value {
      font-family: var(--font-mono);
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--brand);
      margin-bottom: 1rem;
      letter-spacing: 0.02em;
    }

    .timer-progress {
      height: 6px;
      background: var(--surface-3);
      border-radius: 100px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, var(--brand), #38bdf8);
      border-radius: 100px;
      transition: width 1s linear;
    }

    .timer-hint {
      font-size: 0.6875rem;
      color: var(--ink-muted);
      margin: 0.75rem 0 0;
      letter-spacing: 0.01em;
    }

    /* ─── Exam Header ─── */
    .exam-header {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
    }

    .exam-header svg {
      color: var(--brand);
      flex-shrink: 0;
    }

    .exam-header h1 {
      font-size: clamp(1.125rem, 2vw + 0.5rem, 1.5rem);
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
      line-height: 1.3;
    }

    .exam-header h1 span {
      color: var(--brand);
      font-weight: 500;
    }

    /* ─── Questions ─── */
    .question-list {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding-bottom: 1rem;
    }

    .question-card {
      background: var(--surface-1);
      border-radius: var(--radius);
      box-shadow: var(--shadow-xs);
      border: 1px solid var(--border-subtle);
      overflow: hidden;
      transition: box-shadow var(--duration) var(--ease), border-color var(--duration) var(--ease);
    }

    .question-card:hover {
      box-shadow: var(--shadow-sm);
      border-color: var(--border-default);
    }

    .question-content {
      padding: 1.125rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-2);
    }

    .question-content p {
      margin: 0;
      font-size: 0.9375rem;
      line-height: 1.65;
    }

    .question-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--brand);
      background: var(--brand-subtle);
      border-radius: 50%;
      margin-right: 0.625rem;
      vertical-align: text-bottom;
    }

    .options-list {
      border: none;
      padding: 0.75rem 1rem;
      margin: 0;
    }

    .option-item {
      display: flex;
      align-items: center;
      padding: 0.75rem 0.875rem;
      margin-bottom: 0.375rem;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all var(--duration) var(--ease);
      position: relative;
    }

    .option-item:last-child {
      margin-bottom: 0;
    }

    .option-item:hover {
      background: var(--surface-2);
      border-color: var(--border-subtle);
    }

    .option-item:has(input:checked) {
      background: var(--brand-subtle);
      border-color: var(--brand);
      box-shadow: 0 0 0 1px var(--brand-glow);
    }

    .option-item:has(input:focus-visible) {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }

    .option-item input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    .option-checkmark {
      width: 18px;
      height: 18px;
      border: 2px solid var(--border-default);
      border-radius: 50%;
      margin-right: 0.75rem;
      flex-shrink: 0;
      transition: all var(--duration) var(--ease);
      position: relative;
      background: var(--surface-1);
    }

    .option-item:hover .option-checkmark {
      border-color: var(--brand);
    }

    .option-item input:checked ~ .option-checkmark {
      border-color: var(--brand);
      background: var(--surface-1);
    }

    .option-item input:checked ~ .option-checkmark::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--brand);
      animation: radio-pop var(--duration) var(--ease);
    }

    @keyframes radio-pop {
      0% { transform: scale(0); }
      60% { transform: scale(1.15); }
      100% { transform: scale(1); }
    }

    .option-text {
      font-size: 0.875rem;
      color: var(--ink-secondary);
      line-height: 1.5;
    }

    .option-item input:checked ~ .option-text {
      color: var(--ink-primary);
      font-weight: 500;
    }

    /* ─── Submit Button ─── */
    .exam-actions {
      display: flex;
      justify-content: center;
      padding: 1.5rem 0 2rem;
    }

    .btn-submit {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      background: var(--brand);
      color: var(--ink-inverse);
      border: none;
      border-radius: var(--radius);
      padding: 0.75rem 2.25rem;
      font-size: 0.9375rem;
      font-weight: 600;
      font-family: var(--font);
      cursor: pointer;
      transition: all var(--duration) var(--ease);
      box-shadow: var(--shadow-sm), 0 0 0 0 var(--brand-glow);
      letter-spacing: -0.01em;
    }

    .btn-submit:hover {
      background: var(--brand-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md), 0 0 0 4px var(--brand-glow);
    }

    .btn-submit:active {
      transform: translateY(0);
      box-shadow: var(--shadow-xs);
    }

    .btn-submit:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }

    /* ─── Results ─── */
    .results-container {
      font-family: var(--font);
      max-width: 520px;
      margin: 5rem auto;
      padding: 1.5rem;
      animation: slide-up 0.4s var(--ease);
    }

    @keyframes slide-up {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .results-card {
      background: var(--surface-1);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-subtle);
      overflow: hidden;
    }

    .results-header {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 1.5rem;
      background: linear-gradient(135deg, var(--brand-subtle), var(--surface-1));
      border-bottom: 1px solid var(--border-subtle);
    }

    .results-header svg {
      color: var(--brand);
      flex-shrink: 0;
    }

    .results-header h2 {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .cancelled .results-header {
      background: linear-gradient(135deg, var(--danger-subtle), var(--surface-1));
    }

    .cancelled-header svg { color: var(--danger); }

    .results-content {
      padding: 1.5rem;
    }

    .results-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 1rem;
      border-radius: var(--radius);
      background: var(--surface-2);
      border: 1px solid var(--border-subtle);
    }

    .result-icon {
      font-size: 1.25rem;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      background: var(--surface-1);
      flex-shrink: 0;
      box-shadow: var(--shadow-xs);
    }

    .result-details h3 {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--ink-muted);
      margin: 0 0 0.125rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .result-details p {
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--brand);
      margin: 0;
      font-family: var(--font-mono);
    }

    .cancellation-reason {
      font-size: 1rem;
      font-weight: 600;
      color: var(--danger);
      margin: 0 0 0.5rem;
      line-height: 1.5;
    }

    .cancellation-info {
      color: var(--ink-secondary);
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.6;
    }

    .results-actions {
      display: flex;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem;
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-2);
    }

    .btn-home {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      font-family: var(--font);
      border-radius: var(--radius-sm);
      cursor: pointer;
      border: 1px solid var(--border-default);
      background: var(--surface-1);
      color: var(--ink-secondary);
      flex: 1;
      justify-content: center;
      transition: all var(--duration) var(--ease);
      letter-spacing: -0.01em;
    }

    .btn-home:hover {
      background: var(--surface-0);
      border-color: var(--brand);
      color: var(--brand);
      box-shadow: var(--shadow-sm);
    }

    .btn-home:active {
      transform: scale(0.98);
    }

    .btn-home:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }

    /* ─── Responsive ─── */
    @media (max-width: 992px) {
      .exam-layout {
        flex-direction: column;
      }
      .exam-sidebar {
        width: 100%;
        position: static;
      }
      .results-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .exam-container {
        padding: 1rem;
      }
      .exam-header h1 {
        font-size: 1.125rem;
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  // --- Datos simulados del examen (en producción vendrían del backend via PreguntaService) ---
  readonly questions: ExamQuestion[] = [
    {
      id: 1,
      content: '¿Cuál es el principal beneficio de usar Standalone Components en Angular?',
      options: [
        'Reducción de Boilerplate (No NgModules)',
        'Mayor velocidad de ejecución',
        'Compatibilidad con AngularJS',
        'Soporte para Web Workers'
      ],
      correctAnswer: 'Reducción de Boilerplate (No NgModules)'
    },
    {
      id: 2,
      content: '¿Qué función de Angular se usa para crear estado reactivo con Signals?',
      options: [
        'observable()',
        'signal()',
        'watch()',
        'reactive()'
      ],
      correctAnswer: 'signal()'
    },
    {
      id: 3,
      content: '¿Cuál es la estrategia de detección de cambios recomendada para rendimiento?',
      options: [
        'ChangeDetectionStrategy.Default',
        'ChangeDetectionStrategy.OnPush',
        'ChangeDetectionStrategy.Manual',
        'ChangeDetectionStrategy.Lazy'
      ],
      correctAnswer: 'ChangeDetectionStrategy.OnPush'
    },
    {
      id: 4,
      content: '¿Cuál es la sintaxis moderna para condicionales en templates de Angular v17+?',
      options: [
        '*ngIf="condition"',
        'v-if="condition"',
        '@if (condition) { }',
        '{{#if condition}}'
      ],
      correctAnswer: '@if (condition) { }'
    },
    {
      id: 5,
      content: '¿Qué función se usa para inyección de dependencias en Angular moderno?',
      options: [
        'constructor injection solamente',
        'inject()',
        '@Inject() decorator',
        'provide()'
      ],
      correctAnswer: 'inject()'
    }
  ];

  // --- Estado reactivo del examen (signals permiten OnPush sin suscripciones manuales) ---
  examState = signal<ExamState>('taking');
  answers = signal<Record<number, string>>({});
  timerSeconds = signal(0);
  cancellationReason = signal('');
  private timerId: ReturnType<typeof setInterval> | null = null;
  private totalSeconds = 0;

  // --- Propiedades derivadas (se recalculan automáticamente cuando cambian las signals de origen) ---
  timerFormatted = computed(() => {
    const t = this.timerSeconds();
    const mm = Math.floor(t / 60);
    const ss = t - mm * 60;
    return `${mm} min : ${ss < 10 ? '0' + ss : ss} seg`;
  });

  timerPercent = computed(() => {
    if (this.totalSeconds === 0) return 100;
    return (this.timerSeconds() / this.totalSeconds) * 100;
  });

  correctCount = computed(() => {
    const a = this.answers();
    return this.questions.filter(q => a[q.id] === q.correctAnswer).length;
  });

  score = computed(() => this.correctCount() * 10);

  // --- Configuración de SUSIE: define qué protecciones activar y cómo manejar violaciones ---
  examConfig: SusieConfig = {
    sessionContext: {
      examSessionId: 'sess_' + Math.floor(Math.random() * 10000),
      examId: 'cert_angular_v20',
      durationMinutes: 5 // 5 min para la demo (en producción se configura por examen)
    },
    securityPolicies: {
      requireCamera: true,
      requireMicrophone: true,
      requireFullscreen: true,
      requireConsent: true,
      preventTabSwitch: true,
      preventInspection: true,
      preventBackNavigation: true,
      preventPageReload: true,
    },
    audioConfig: {
      enabled: true,
      chunkIntervalSeconds: 10,
      bitrate: 32000
    },
    onSecurityViolation: (violation: SecurityViolation) => {
      this.cancelExam(violation.message);
    },
    onConsentResult: (result: ConsentResult) => {
      console.log('📋 Resultado del consentimiento:', result);
      if (result.accepted) {
        this.startTimer();
      }
    },
    debugMode: true,
    apiUrl: 'http://localhost:8000/api/v1',
    authToken: 'demo-jwt-token-xyz'
  };

  ngOnInit() {
    this.totalSeconds = this.questions.length * 60; // 1 min per question
    this.timerSeconds.set(this.totalSeconds);
    // Timer NO se inicia aquí — espera a que el consentimiento sea aceptado
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  selectAnswer(questionId: number, option: string) {
    this.answers.update(a => ({ ...a, [questionId]: option }));
  }

  submitExam() {
    this.stopTimer();
    this.examState.set('submitted');
  }

  resetExam() {
    this.answers.set({});
    this.totalSeconds = this.questions.length * 60;
    this.timerSeconds.set(this.totalSeconds);
    this.examState.set('taking');
    this.cancellationReason.set('');
    this.startTimer();
  }

  private cancelExam(reason: string) {
    this.stopTimer();
    this.cancellationReason.set(reason);
    this.examState.set('cancelled');
  }

  private startTimer() {
    this.stopTimer();
    this.timerId = setInterval(() => {
      const current = this.timerSeconds();
      if (current <= 0) {
        this.submitExam(); // Envío automático al agotar el tiempo — evita que el alumno se quede sin enviar
      } else {
        this.timerSeconds.update(t => t - 1);
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
