import { ChaindrencialesExamConfig } from 'ngx-susie-proctoring';

/**
 * Configuración mock que simula la respuesta del API de Chaindrenciales.
 * Se usa en desarrollo mientras el endpoint real no existe.
 *
 * Cuando Chaindrenciales tenga su API listo, esta constante se reemplaza
 * por una llamada real vía ExamConfigService.
 */
export const MOCK_CHAINDRENCIALES_CONFIG: ChaindrencialesExamConfig = {
    sessionContext: {
        examSessionId: 'sess_' + Math.floor(Math.random() * 10000),
        examId: 'cert_angular_v20',
        examTitle: 'Certificación Profesional Angular v20',
        durationMinutes: 30,
        assignmentId: 1,
    },
    supervision: {
        requireCamera: false,
        requireMicrophone: true,
        requireBiometrics: false,
        requireGazeTracking: false,
        maxTabSwitches: 3,
        inactivityTimeoutMinutes: 0.25,
    },
    questions: [
        {
            id: 1,
            content: '¿Cuál es el principal beneficio de usar Standalone Components en Angular?',
            options: [
                'Reducción de Boilerplate (No NgModules)',
                'Mayor velocidad de ejecución',
                'Compatibilidad con AngularJS',
                'Soporte para Web Workers'
            ],
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
        },
    ],
    susieApiUrl: 'http://localhost:8000/susie/api/v1',
    authToken: 'demo-jwt-token-xyz',
};
