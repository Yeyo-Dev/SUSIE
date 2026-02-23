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
  templateUrl: './consent-dialog.component.html',
  styleUrl: './consent-dialog.component.css'
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
