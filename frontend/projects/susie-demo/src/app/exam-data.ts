import { SusieConfig, SecurityViolation, ConsentResult, ExamResult } from 'ngx-susie-proctoring';

export interface ExamQuestion {
    /** Identificador único numérico de la pregunta. */
    id: number;
    /** Texto de la pregunta que se mostrará al usuario. */
    content: string;
    /** Lista de opciones de respuesta posibles. */
    options: string[];
    /** Texto exacto de la respuesta correcta para validación. */
    correctAnswer: string;
}

export type ExamState = 'taking' | 'submitted' | 'cancelled';

/**
 * Preguntas simuladas del examen.
 * En producción vendrían del backend via un servicio.
 */
export const EXAM_QUESTIONS: ExamQuestion[] = [
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

/**
 * Crea la configuración de SUSIE para el examen demo.
 * @param component Referencia al componente para binding de callbacks.
 */
export function createExamConfig(component: {
    cancelExam: (reason: string) => void;
    handleExamFinished: (result: ExamResult) => void;
}): SusieConfig {
    return {
        sessionContext: {
            examSessionId: 'sess_' + Math.floor(Math.random() * 10000),
            examId: 'cert_angular_v20',
            examTitle: 'Certificación Profesional Angular v20',
            durationMinutes: 5,
        },
        securityPolicies: {
            requireCamera: false, // Desactivado para prueba local
            requireMicrophone: false, // Desactivado para prueba local
            requireFullscreen: true,
            requireConsent: true,
            requireEnvironmentCheck: false, // No tiene sentido sin cámara
            requireBiometrics: false, // Desactivado sin cámara
            preventTabSwitch: true,
            preventInspection: true,
            preventBackNavigation: true,
            preventPageReload: true,
            preventCopyPaste: true // Nuevo
        },

        audioConfig: {
            enabled: true,
            chunkIntervalSeconds: 10,
            bitrate: 32000,
        },
        onSecurityViolation: (violation: SecurityViolation) => {
            component.cancelExam(violation.message);
        },
        onConsentResult: (result: ConsentResult) => {
            console.log('📋 Resultado del consentimiento:', result);
            // El wrapper inicia automáticamente el engine si es aceptado
        },
        onExamFinished: (result: ExamResult) => {
            component.handleExamFinished(result);
        },
        onEnvironmentCheckResult: (result: { passed: boolean }) => {
            console.log('🔍 Resultado de verificación de entorno:', result);
        },
        onInactivityDetected: () => {
            console.log('⏸️ Inactividad detectada — usuario confirmó presencia');
        },
        inactivityTimeoutMinutes: 0.25,
        debugMode: true,
        apiUrl: 'http://localhost:8000/api/v1',
        authToken: 'demo-jwt-token-xyz',
    };
}
