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
    },
    {
        id: 6,
        content: '¿Qué es un Observable en RxJS?',
        options: [
            'Una promesa',
            'Un flujo de eventos asíncrono',
            'Una función puramente síncrona',
            'Un tipo de array inmutable'
        ],
        correctAnswer: 'Un flujo de eventos asíncrono'
    },
    {
        id: 7,
        content: '¿Cuál es la diferencia principal entre interface y type en TypeScript?',
        options: [
            'Solo interface soporta merging de declaraciones',
            'Solo type puede ser exportado',
            'Interface no soporta herencia',
            'Type es solo para primitivos'
        ],
        correctAnswer: 'Solo interface soporta merging de declaraciones'
    },
    {
        id: 8,
        content: '¿Qué significa que un Pipe sea "puro"?',
        options: [
            'Que no tiene efectos secundarios',
            'Que solo se ejecuta si cambia la referencia de entrada',
            'Que usa ChangeDetectionStrategy.OnPush',
            'Que no depende de servicios externos'
        ],
        correctAnswer: 'Que solo se ejecuta si cambia la referencia de entrada'
    },
    {
        id: 9,
        content: '¿Cuál selector CSS tiene mayor especificidad?',
        options: [
            '#id',
            '.clase',
            'div',
            '*'
        ],
        correctAnswer: '#id'
    },
    {
        id: 10,
        content: '¿Qué hook se ejecuta después de inicializar las vistas del componente?',
        options: [
            'ngOnInit',
            'ngAfterViewInit',
            'ngOnChanges',
            'ngDoCheck'
        ],
        correctAnswer: 'ngAfterViewInit'
    },
    {
        id: 11,
        content: '¿Qué hace "defer" en un script tag?',
        options: [
            'Ejecuta el script inmediatamente',
            'Ejecuta el script después de parsear el HTML',
            'Bloquea el renderizado',
            'Carga el script síncronamente'
        ],
        correctAnswer: 'Ejecuta el script después de parsear el HTML'
    },
    {
        id: 12,
        content: '¿Cuál es el propósito de "track" en el nuevo @for loop?',
        options: [
            'Rastrear analíticas de usuario',
            'Optimizar el rendimiento del DOM diffing',
            'No es obligatorio',
            'Ordenar la lista alfabéticamente'
        ],
        correctAnswer: 'Optimizar el rendimiento del DOM diffing'
    },
    {
        id: 13,
        content: '¿Qué es el "Event Loop" en JavaScript?',
        options: [
            'Un bucle infinito for(;;)',
            'El mecanismo que maneja la ejecución asíncrona',
            'Un evento que se repite cada segundo',
            'El ciclo de vida de un componente'
        ],
        correctAnswer: 'El mecanismo que maneja la ejecución asíncrona'
    },
    {
        id: 14,
        content: '¿Cuál es la diferencia entre "merge" y "switchMap"?',
        options: [
            'merge cancela la suscripción anterior',
            'switchMap cancela la suscripción anterior',
            'Son idénticos',
            'merge solo funciona con promesas'
        ],
        correctAnswer: 'switchMap cancela la suscripción anterior'
    },
    {
        id: 15,
        content: '¿Para qué sirve NgZone?',
        options: [
            'Para definir zonas horarias',
            'Para ejecutar código fuera de la detección de cambios de Angular',
            'Para manejar rutas',
            'Para estilos encapsulados'
        ],
        correctAnswer: 'Para ejecutar código fuera de la detección de cambios de Angular'
    },
    {
        id: 16,
        content: '¿Qué es Shadow DOM?',
        options: [
            'El DOM virtual de React',
            'Una copia oculta del DOM para pruebas',
            'Encapsulación real de estilos y markup',
            'Un modo oscuro para el navegador'
        ],
        correctAnswer: 'Encapsulación real de estilos y markup'
    },
    {
        id: 17,
        content: '¿Cuál es el código HTTP para "No Autorizado"?',
        options: [
            '400',
            '401',
            '403',
            '404'
        ],
        correctAnswer: '401'
    },
    {
        id: 18,
        content: '¿Qué directiva estructural se usa para renderizado condicional?',
        options: [
            '*ngIf',
            '[hidden]',
            'ngStyle',
            'ngClass'
        ],
        correctAnswer: '*ngIf'
    },
    {
        id: 19,
        content: '¿Qué es "Tree Shaking"?',
        options: [
            'Animación de sacudida',
            'Eliminación de código muerto en el bundle final',
            'Un patrón de diseño',
            'Una técnica de testing'
        ],
        correctAnswer: 'Eliminación de código muerto en el bundle final'
    },
    {
        id: 20,
        content: '¿Cuál es el ciclo de vida único de los Signals?',
        options: [
            'ngOnSignalChange',
            'No tienen ciclo de vida explícito, son reactivos',
            'ngSignalInit',
            'ngAfterSignalChecked'
        ],
        correctAnswer: 'No tienen ciclo de vida explícito, son reactivos'
    },
    {
        id: 21,
        content: '¿Qué hace "takeUntilDestroyed"?',
        options: [
            'Destruye el componente inmediatamente',
            'Desuscribe automáticamente Observables al destruir el contexto',
            'Pausa la ejecución hasta que se destruye el objeto',
            'Borra el LocalStorage'
        ],
        correctAnswer: 'Desuscribe automáticamente Observables al destruir el contexto'
    },
    {
        id: 22,
        content: '¿Qué es hydration en SSR?',
        options: [
            'Tomar agua durante el coding',
            'Añadir interactividad JS al HTML estático del servidor',
            'Descargar assets',
            'Compilar TypeScript'
        ],
        correctAnswer: 'Añadir interactividad JS al HTML estático del servidor'
    },
    {
        id: 23,
        content: '¿Cuál es la diferencia entre "root" y "platform" injectors?',
        options: [
            'No hay diferencia',
            'Platform es global para múltiples apps en la página',
            'Root es solo para servicios http',
            'Platform es obsoleto'
        ],
        correctAnswer: 'Platform es global para múltiples apps en la página'
    },
    {
        id: 24,
        content: '¿Qué es "Content Projection"?',
        options: [
            'Proyectar la pantalla en un TV',
            'Insertar contenido HTML dentro de un componente (<ng-content>)',
            'Validar formularios',
            'Animaciones CSS'
        ],
        correctAnswer: 'Insertar contenido HTML dentro de un componente (<ng-content>)'
    },
    {
        id: 25,
        content: '¿Para qué sirve el pipe "async"?',
        options: [
            'Para hacer el código más rápido',
            'Para suscribirse y desuscribirse automáticamente a Observables/Promesas en el template',
            'Para llamadas HTTP POST',
            'Para cargar módulos lazy'
        ],
        correctAnswer: 'Para suscribirse y desuscribirse automáticamente a Observables/Promesas en el template'
    },
    {
        id: 26,
        content: '¿Qué es un Service Worker?',
        options: [
            'Un empleado de soporte técnico',
            'Un script que el navegador ejecuta en segundo plano (caching, push)',
            'Un servicio de Angular',
            'Una API REST'
        ],
        correctAnswer: 'Un script que el navegador ejecuta en segundo plano (caching, push)'
    },
    {
        id: 27,
        content: '¿Cuál es la mejor práctica para evitar Memory Leaks en suscripciones manuales?',
        options: [
            'No usar suscripciones',
            'Usar .unsubscribe() en ngOnDestroy',
            'Angular lo hace solo siempre',
            'Reiniciar el navegador'
        ],
        correctAnswer: 'Usar .unsubscribe() en ngOnDestroy'
    },
    {
        id: 28,
        content: '¿Qué es "Lazy Loading"?',
        options: [
            'Cargar imágenes lentamente',
            'Cargar módulos/componentes solo cuando se necesitan',
            'Un spinner de carga',
            'Programación perezosa'
        ],
        correctAnswer: 'Cargar módulos/componentes solo cuando se necesitan'
    },
    {
        id: 29,
        content: '¿Cuál es la diferencia entre "null" y "undefined"?',
        options: [
            'Son lo mismo',
            'null es un valor asignado explícitamente, undefined es no inicializado',
            'undefined es un error',
            'null es un objeto'
        ],
        correctAnswer: 'null es un valor asignado explícitamente, undefined es no inicializado'
    },
    {
        id: 30,
        content: '¿Qué es SOLID?',
        options: [
            'Un estado de la materia',
            '5 principios de diseño orientado a objetos',
            'Una librería de UI',
            'Un framework de CSS'
        ],
        correctAnswer: '5 principios de diseño orientado a objetos'
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
            durationMinutes: 30,
        },
        securityPolicies: {
            requireCamera: false, // Desactivado para prueba local
            requireMicrophone: true, // Desactivado para prueba local
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
            chunkIntervalSeconds: 15,
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
        apiUrl: 'http://localhost:8000/susie/api/v1',
        authToken: 'demo-jwt-token-xyz',
    };
}
