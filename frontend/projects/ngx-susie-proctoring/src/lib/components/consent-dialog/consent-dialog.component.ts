import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { ConsentResult, ConsentPermission, SusieConfig } from '../../models/contracts';

/**
 * Componente de consentimiento de términos y condiciones.
 *
 * Pantalla completa que muestra los T&C dinámicos según los permisos
 * requeridos por el examen (cámara, micrófono, biometría).
 * El candidato debe aceptar para continuar con el examen.
 *
 * @example
 * ```html
 * <susie-consent-dialog
 *   [config]="examConfig"
 *   (consentGiven)="onConsent($event)" />
 * ```
 */
@Component({
  selector: 'susie-consent-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'susie-consent-dialog',
    'role': 'dialog',
    '[attr.aria-modal]': 'true',
    '[attr.aria-label]': '"Términos y condiciones del examen"',
  },
  template: `
    <div class="consent-backdrop">
      <div class="consent-container">
        @if (consentState() === 'pending') {
          <div class="consent-card">
            <header class="consent-header">
              <div class="header-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h1 id="consent-title">Términos y Condiciones de Supervisión</h1>
              <p class="subtitle">Este examen requiere supervisión digital. Por favor lee y acepta los siguientes términos para continuar.</p>
            </header>

            <main class="consent-body" aria-labelledby="consent-title">
              <section class="terms-section">
                <h2>Permisos requeridos</h2>
                <ul class="permissions-list" role="list">
                  @for (item of consentItems(); track item.permission) {
                    <li class="permission-item">
                      <span class="permission-icon" aria-hidden="true">{{ item.icon }}</span>
                      <div class="permission-text">
                        <strong>{{ item.title }}</strong>
                        <p>{{ item.description }}</p>
                      </div>
                    </li>
                  }
                </ul>
              </section>

              <section class="terms-section">
                <h2>Uso de datos</h2>
                <p>Los datos recopilados durante el examen se utilizarán exclusivamente para la supervisión y verificación de la evaluación. No se compartirán con terceros ni se utilizarán para otros fines.</p>
                <p>Al aceptar estos términos, confirmas que:</p>
                <ul role="list">
                  <li>Eres la persona asignada para presentar este examen.</li>
                  <li>Autorizas el uso de los recursos indicados durante la evaluación.</li>
                  <li>Comprendes que cualquier irregularidad detectada será reportada.</li>
                </ul>
              </section>
            </main>

            <footer class="consent-footer">
              <label class="checkbox-container" id="consent-checkbox-label">
                <input
                  type="checkbox"
                  [checked]="isChecked()"
                  (change)="onCheckboxChange($event)"
                  aria-describedby="consent-checkbox-label" />
                <span class="checkmark" aria-hidden="true"></span>
                <span class="checkbox-text">He leído y acepto los términos y condiciones de supervisión</span>
              </label>

              <div class="button-group">
                <button
                  type="button"
                  class="btn btn-reject"
                  (click)="onReject()">
                  Rechazar
                </button>
                <button
                  type="button"
                  class="btn btn-accept"
                  [disabled]="!isChecked()"
                  [attr.aria-disabled]="!isChecked()"
                  (click)="onAccept()">
                  Aceptar y continuar
                </button>
              </div>
            </footer>
          </div>
        } @else {
          <!-- Estado de rechazo con opción de reconsiderar -->
          <div class="consent-card rejected-card">
            <div class="rejected-content">
              <div class="rejected-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h1>Acceso al examen bloqueado</h1>
              <p>Has rechazado los términos y condiciones de supervisión. No es posible iniciar el examen sin aceptar estos términos.</p>
              <p class="reconsider-text">Si deseas reconsiderar, puedes volver a leer los términos.</p>
              <button
                type="button"
                class="btn btn-reconsider"
                (click)="onReconsider()">
                Volver a leer los términos
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 10000;
    }

    .consent-backdrop {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .consent-container {
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }

    .consent-card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
      animation: card-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes card-enter {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* --- Header --- */
    .consent-header {
      padding: 2rem 2rem 1.5rem;
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .header-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      border-radius: 14px;
      color: #ffffff;
      margin-bottom: 1rem;
    }

    h1 {
      font-size: 1.375rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.5rem;
      line-height: 1.3;
    }

    .subtitle {
      font-size: 0.875rem;
      color: #64748b;
      margin: 0;
      line-height: 1.5;
    }

    /* --- Body --- */
    .consent-body {
      padding: 1.5rem 2rem;
      overflow-y: auto;
      flex: 1 1 auto;
    }

    .terms-section {
      margin-bottom: 1.5rem;
    }

    .terms-section:last-child {
      margin-bottom: 0;
    }

    h2 {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 0.75rem;
    }

    .terms-section p {
      font-size: 0.875rem;
      color: #334155;
      line-height: 1.6;
      margin: 0 0 0.5rem;
    }

    .terms-section ul {
      font-size: 0.875rem;
      color: #334155;
      line-height: 1.6;
      padding-left: 1.25rem;
      margin: 0.5rem 0 0;
    }

    .terms-section li {
      margin-bottom: 0.25rem;
    }

    /* --- Permissions list --- */
    .permissions-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .permission-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      transition: background-color 0.15s ease;
    }

    .permission-icon {
      font-size: 1.25rem;
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eff6ff;
      border-radius: 8px;
    }

    .permission-text strong {
      display: block;
      font-size: 0.875rem;
      color: #0f172a;
      margin-bottom: 0.125rem;
    }

    .permission-text p {
      font-size: 0.8125rem;
      color: #64748b;
      margin: 0;
      line-height: 1.4;
    }

    /* --- Footer --- */
    .consent-footer {
      padding: 1.5rem 2rem;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    /* --- Checkbox --- */
    .checkbox-container {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      cursor: pointer;
      margin-bottom: 1.25rem;
      padding: 0.875rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      transition: border-color 0.15s ease;
    }

    .checkbox-container:hover {
      border-color: #3b82f6;
    }

    .checkbox-container:focus-within {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .checkbox-container input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    .checkmark {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      border: 2px solid #cbd5e1;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      margin-top: 1px;
    }

    .checkbox-container input:checked + .checkmark {
      background: #3b82f6;
      border-color: #3b82f6;
    }

    .checkbox-container input:checked + .checkmark::after {
      content: '';
      width: 5px;
      height: 9px;
      border: solid #ffffff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
      margin-top: -1px;
    }

    .checkbox-container input:focus-visible + .checkmark {
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
    }

    .checkbox-text {
      font-size: 0.875rem;
      color: #334155;
      line-height: 1.5;
      font-weight: 500;
    }

    /* --- Buttons --- */
    .button-group {
      display: flex;
      gap: 0.75rem;
    }

    .btn {
      flex: 1;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      line-height: 1.4;
    }

    .btn:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    .btn-reject {
      background: #f1f5f9;
      color: #475569;
    }

    .btn-reject:hover {
      background: #e2e8f0;
    }

    .btn-accept {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
    }

    .btn-accept:hover:not(:disabled) {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }

    .btn-accept:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    /* --- Rejected state --- */
    .rejected-card {
      text-align: center;
    }

    .rejected-content {
      padding: 3rem 2rem;
    }

    .rejected-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      background: #fef2f2;
      border-radius: 50%;
      color: #dc2626;
      margin-bottom: 1.5rem;
    }

    .rejected-content h1 {
      font-size: 1.375rem;
      color: #0f172a;
      margin-bottom: 0.75rem;
    }

    .rejected-content p {
      font-size: 0.875rem;
      color: #64748b;
      line-height: 1.6;
      margin: 0 0 0.5rem;
      max-width: 440px;
      margin-left: auto;
      margin-right: auto;
    }

    .reconsider-text {
      margin-top: 1rem;
    }

    .btn-reconsider {
      margin-top: 1.5rem;
      background: #f1f5f9;
      color: #3b82f6;
      border: 1px solid #3b82f6;
      padding: 0.75rem 2rem;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-reconsider:hover {
      background: #eff6ff;
    }

    .btn-reconsider:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    /* --- Responsive --- */
    @media (max-width: 640px) {
      .consent-header {
        padding: 1.5rem 1.25rem 1rem;
      }

      .consent-body {
        padding: 1.25rem;
      }

      .consent-footer {
        padding: 1.25rem;
      }

      .button-group {
        flex-direction: column-reverse;
      }

      h1 {
        font-size: 1.25rem;
      }
    }
  `],
})
export class ConsentDialogComponent {
  /** Configuración completa del examen — se usa para derivar permisos necesarios. */
  config = input.required<SusieConfig>();

  /** Emite el resultado del consentimiento (aceptado o rechazado). */
  consentGiven = output<ConsentResult>();

  /** Estado interno: pending = mostrando T&C, rejected = pantalla de bloqueo. */
  consentState = signal<'pending' | 'rejected'>('pending');

  /** Estado del checkbox. */
  isChecked = signal(false);

  /** Items dinámicos de consentimiento basados en la configuración del examen. */
  consentItems = computed(() => {
    const policies = this.config().securityPolicies;
    const items: { permission: ConsentPermission; icon: string; title: string; description: string }[] = [];

    if (policies.requireCamera) {
      items.push({
        permission: 'camera',
        icon: '📷',
        title: 'Cámara web',
        description: 'Se capturarán imágenes periódicas durante el examen para verificar tu presencia y detectar irregularidades.',
      });
    }

    if (policies.requireMicrophone) {
      items.push({
        permission: 'microphone',
        icon: '🎤',
        title: 'Micrófono',
        description: 'Se grabará audio del entorno durante el examen para análisis de supervisión.',
      });
    }

    if (policies.requireBiometrics) {
      items.push({
        permission: 'biometrics',
        icon: '🔐',
        title: 'Verificación biométrica',
        description: 'Se verificará tu identidad mediante reconocimiento facial antes de iniciar el examen.',
      });
    }

    return items;
  });

  /** Permisos activos extraídos de la configuración. */
  private activePermissions = computed<ConsentPermission[]>(() =>
    this.consentItems().map(item => item.permission),
  );

  onCheckboxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.isChecked.set(target.checked);
  }

  onAccept(): void {
    if (!this.isChecked()) return;

    this.consentGiven.emit({
      accepted: true,
      timestamp: new Date().toISOString(),
      permissionsConsented: this.activePermissions(),
    });
  }

  onReject(): void {
    this.consentState.set('rejected');

    this.consentGiven.emit({
      accepted: false,
      timestamp: new Date().toISOString(),
      permissionsConsented: [],
    });
  }

  onReconsider(): void {
    this.consentState.set('pending');
    this.isChecked.set(false);
  }
}
