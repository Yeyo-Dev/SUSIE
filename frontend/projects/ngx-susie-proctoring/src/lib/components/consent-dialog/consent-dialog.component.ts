import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { ConsentResult, ConsentPermission, SusieConfig, StepInfo } from '../../models/contracts';
import { StepIndicatorComponent } from '../step-indicator/step-indicator.component';

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
  imports: [StepIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'susie-consent-dialog',
    'role': 'dialog',
    '[attr.aria-modal]': 'true',
    '[attr.aria-label]': '"Términos y condiciones del examen"',
  },
  templateUrl: './consent-dialog.component.html',
  styleUrl: './consent-dialog.component.css'
})
export class ConsentDialogComponent {
  /** Configuración completa del examen — se usa para derivar permisos necesarios. */
  config = input.required<SusieConfig>();

  /** Pasos dinámicos del indicador (recibidos del wrapper) */
  steps = input<StepInfo[]>([]);

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

    if (policies.requireGazeTracking) {
      items.push({
        permission: 'gazeTracking' as any,
        icon: '👁️',
        title: 'Seguimiento de mirada',
        description: 'Se monitoreará la dirección de tu mirada durante el examen mediante tu cámara web para detectar comportamientos inusuales.',
      });
    }

    if (policies.preventTabSwitch) {
      const max = this.config().maxTabSwitches;
      items.push({
        permission: 'fullscreen' as any,
        icon: '🖥️',
        title: 'Pantalla completa obligatoria',
        description: max !== undefined
          ? `Debes permanecer en esta ventana durante todo el examen. Tienes un máximo de ${max} cambio(s) de pestaña permitidos. Si los superas, tu examen será cancelado automáticamente.`
          : 'Debes permanecer en esta ventana durante todo el examen. Cambiar de pestaña o salir de pantalla completa será registrado como una infracción.',
      });
    }

    return items;
  });

  /**
   * Texto dinámico de aviso de privacidad construido localmente
   * en base a los componentes de hardware habilitados.
   */
  privacyNotice = computed(() => {
    const policies = this.config().securityPolicies;
    const dataTypes: string[] = [];

    if (policies.requireCamera) dataTypes.push('imágenes periódicas de tu cámara');
    if (policies.requireMicrophone) dataTypes.push('grabaciones de audio del entorno');
    if (policies.requireBiometrics) dataTypes.push('datos de verificación facial');
    if (policies.requireGazeTracking) dataTypes.push('coordenadas de seguimiento de mirada');

    if (dataTypes.length === 0) {
      return 'Se monitorizará tu actividad en el navegador durante la evaluación.';
    }

    const formatted = dataTypes.length === 1
      ? dataTypes[0]
      : dataTypes.slice(0, -1).join(', ') + ' y ' + dataTypes[dataTypes.length - 1];

    return `Durante esta evaluación se recopilarán ${formatted}. Estos datos se utilizarán exclusivamente para la supervisión y verificación del examen.`;
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
