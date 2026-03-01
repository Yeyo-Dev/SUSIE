import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SusieConfig, StepInfo } from '../../models/contracts';
import { StepIndicatorComponent } from '../step-indicator/step-indicator.component';

interface BriefingRule {
    icon: string;
    label: string;
    description: string;
}

/**
 * Componente de recordatorio/briefing pre-examen.
 * Muestra las reglas y configuraciones del examen antes de iniciar el temporizador.
 */
@Component({
    selector: 'susie-exam-briefing',
    standalone: true,
    imports: [CommonModule, StepIndicatorComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './exam-briefing.component.html',
    styleUrl: './exam-briefing.component.css'
})
export class ExamBriefingComponent {
    config = input.required<SusieConfig>();
    steps = input<StepInfo[]>([]);
    briefingAcknowledged = output<void>();

    /** Reglas dinámicas calculadas desde la config */
    rules = computed<BriefingRule[]>(() => {
        const cfg = this.config();
        const pol = cfg.securityPolicies;
        const rules: BriefingRule[] = [];

        // Duración
        rules.push({
            icon: '⏱️',
            label: 'Duración del examen',
            description: `${cfg.sessionContext.durationMinutes} minutos`
        });

        // Cámara
        if (pol.requireCamera) {
            rules.push({
                icon: '📷',
                label: 'Cámara activa',
                description: 'Tu cámara estará grabando durante todo el examen'
            });
        }

        // Micrófono
        if (pol.requireMicrophone) {
            rules.push({
                icon: '🎤',
                label: 'Micrófono activo',
                description: 'Tu micrófono estará grabando durante todo el examen'
            });
        }

        // Pantalla completa (siempre activa)
        if (pol.requireFullscreen) {
            rules.push({
                icon: '🖥️',
                label: 'Pantalla completa obligatoria',
                description: 'No puedes salir del modo pantalla completa'
            });
        }

        // Tabulaciones
        if (pol.preventTabSwitch) {
            const max = cfg.maxTabSwitches;
            rules.push({
                icon: '🚫',
                label: 'Cambio de pestaña restringido',
                description: max !== undefined
                    ? `Máximo ${max} cambio(s) de pestaña permitido(s). Después se cancela el examen.`
                    : 'No puedes cambiar de pestaña durante el examen'
            });
        }

        // Copiar/Pegar
        if (pol.preventCopyPaste) {
            rules.push({
                icon: '📋',
                label: 'Copiar y pegar deshabilitado',
                description: 'No se permite copiar, cortar ni pegar contenido'
            });
        }

        // Seguimiento ocular
        if (pol.requireGazeTracking) {
            rules.push({
                icon: '👁️',
                label: 'Seguimiento ocular activo',
                description: 'Se monitoreará la dirección de tu mirada durante el examen'
            });
        }

        // DevTools
        if (pol.preventInspection) {
            rules.push({
                icon: '🔒',
                label: 'Herramientas de desarrollador bloqueadas',
                description: 'No se permite abrir la consola del navegador'
            });
        }

        return rules;
    });

    onAcknowledge() {
        this.briefingAcknowledged.emit();
    }
}
