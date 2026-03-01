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
        requireCamera: true,
        requireMicrophone: true,
        requireBiometrics: true,
        requireGazeTracking: true,
        maxTabSwitches: 3,
        inactivityTimeoutMinutes: 0.25,
    },
    questions: [
        {
            id: 1,
            content: 'En un entorno empresarial de alto rendimiento utilizando arquitecturas de micro-frontends distribuidos a gran escala, equipos interfuncionales suelen adoptar Angular debido a sus capacidades completas que trae la estructura de serie. Sin embargo, en implementaciones más recientes después de Angular v15, se ha recomendado una reestructuración significativa en cómo se organizan y construyen estos elementos aislables dentro del código base. Según la documentación oficial y considerando las migraciones de módulos legados a enfoques más modernos, ¿cuál es el beneficio primario y el impacto arquitectónico más significativo de la adopción exhaustiva del concepto de Standalone Components en proyectos masivos de Angular?',
            options: [
                'Reducción drástica del "Boilerplate" estructural, permitiendo que los componentes, directivas y pipes operen de manera completamente independiente de los NgModules tradicionales, lo que reduce la carga cognitiva, simplifica la carga diferida (lazy loading) a nivel granular y remueve capas innecesarias de anidación.',
                'Aumento exponencial verificable en la velocidad bruta de ejecución del framework y renderizado durante tiempo de ejecución mediante la paralelización de hilos asíncronos en navegadores modernos sin usar Web Workers.',
                'Retrocompatibilidad absoluta y nativa incorporada por defecto que permite correr e incrustar de forma transparente directivas directas de AngularJS legado dentro de nuevos flujos de renderizado zoneless.',
                'El aislamiento intrínseco garantizado proporciona un entorno que compila y empaca individualmente todo el CSS y código JS dependiente que hace transparente la delegación directa de UI render a Web Workers usando el DOM virtual exclusivo del framework.'
            ],
        },
        {
            id: 2,
            content: 'La reactividad en Angular históricamente dependía fuertemente de RxJS y zone.js para el seguimiento y propagación de los cambios de estado hacia la capa visual de la aplicación. Con la introducción de paradigmas reactivos más finos y síncronos en las versiones recientes de Angular, inspirados de frameworks pares en el ecosistema front-end moderno, ¿qué primitiva reactiva principal ofrece ahora Angular, la cual permite notificar a componentes dependientes cuándo ha habido una modificación de valor sin requerir suscripciones explícitas complejas ni chequeos impuros del árbol de componentes completo?',
            options: [
                'observable() - una nueva variante nativa del navegador soportada dentro del motor central de Angular que reemplaza Observable de RxJS.',
                'signal() - una envoltura de un valor reactivo primitivo puro que alerta a sus consumidores dependientes (como plantillas y funciones computed) automáticamente notificando cuándo ha cambiado, haciendo el sistema más predecible.',
                'watch() - un decorador integrado derivado de Vue.js adaptado mediante inyección de dependencias para monitorear inputs en tiempo real.',
                'reactive() - una función que proxyfica internamente cualquier objeto o arreglo completo pasado a los componentes para lograr reactividad en profundidad, tal como OnPush mutado.'
            ],
        },
        {
            id: 3,
            content: 'Al diseñar aplicaciones Angular optimizadas y eficientes para dominios de gran volumen transaccional, es crítico gestionar de qué manera y con qué frecuencia el framework interroga a los componentes para confirmar si el estado del modelo base ha cambiado y amerita reflejarlo actualizando el DOM subyacente interactivo. En ese contexto estricto, ¿cuál de las alternativas detalla mejor la única configuración estratégica recomendada comúnmente en desarrollo profesional a gran escala y de forma generalizada aplicable en los decoradores de cada Component para forzar la eficiencia máxima, la inmutabilidad en entradas y acotar cascadas innecesarias?',
            options: [
                'ChangeDetectionStrategy.Default - delegar la gestión del chequeo top-down en cada evento del usuario (clicks, keyups) a través del motor genérico de Zone.js.',
                'ChangeDetectionStrategy.OnPush - instruir al framework a saltarse el chequeo de dicho componente a menos que sus Input bindings cambien de referencia (inmutabilidad), se reciba explícitamente un evento de UI, o se lo marque como "sucio" de forma imperativa.',
                'ChangeDetectionStrategy.Manual - desconectar integralmente el componente de por vida del árbol de inyecciones y llamar manualmente a detectChanges() o markForCheck() repetidamente.',
                'ChangeDetectionStrategy.Lazy - deferir la operación al browser paint layout en una RequestAnimationFrame priorizando estilos sobre re-renders directos de vistas dinámicas locales.'
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
        {
            id: 31,
            content: '¿En qué año se lanzó Angular (la versión reescrita, v2)?',
            options: ['2010', '2014', '2016', '2018'],
        },
        {
            id: 32,
            content: '¿Qué patrón arquitectónico predominante utiliza Angular?',
            options: ['MVC', 'MVVM', 'Component-Based Architecture', 'MVI'],
        },
        {
            id: 33,
            content: '¿Cuál es el decorador para inyectar un valor directamente por token?',
            options: ['@Inject()', '@Injectable()', '@Input()', '@Output()'],
        },
        {
            id: 34,
            content: '¿Qué comando de CLI genera un nuevo componente?',
            options: ['ng new comp', 'ng create comp', 'ng g c', 'ng make component'],
        },
        {
            id: 35,
            content: '¿Qué es ViewEncapsulation.Emulated?',
            options: ['Usa Shadow DOM real', 'Finge Shadow DOM añadiendo atributos únicos al HTML y CSS', 'No aplica encapsulación', 'Es obsoleto'],
        },
        {
            id: 36,
            content: '¿Cómo se lee un parámetro de ruta dinámica en Angular?',
            options: ['Router.getParams', 'ActivatedRoute.snapshot.paramMap', 'window.location', 'this.route.params()'],
        },
        {
            id: 37,
            content: '¿Qué operador de RxJS filtra valores basados en una condición?',
            options: ['map', 'filter', 'reduce', 'tap'],
        },
        {
            id: 38,
            content: '¿Para qué se utiliza el operador "tap" de RxJS?',
            options: ['Para pausar el stream', 'Para depurar o realizar efectos secundarios sin mutar los datos', 'Para mapear valores', 'Para cerrar el stream'],
        },
        {
            id: 39,
            content: '¿Qué hace "behaviorSubject" que no hace un "Subject" normal?',
            options: ['Se completa automáticamente', 'Requiere un valor inicial y emite su valor actual a nuevos suscriptores', 'Solo emite el primer evento', 'Es más rápido'],
        },
        {
            id: 40,
            content: '¿Cuál directiva te permite aplicar estilos dinámicamente?',
            options: ['[style]', '[ngStyle]', '[class]', 'Todas las anteriores'],
        },
        {
            id: 41,
            content: '¿Qué módulo es necesario para usar ngModel?',
            options: ['CommonModule', 'FormsModule', 'ReactiveFormsModule', 'BrowserModule'],
        },
        {
            id: 42,
            content: '¿Qué es un HttpInterceptor?',
            options: ['Un firewall', 'Una clase que intercepta y modifica peticiones/respuestas HTTP globales', 'Un pipe de Angular', 'Un guardia de rutas'],
        },
        {
            id: 43,
            content: '¿Para qué sirve CanActivateFn en Angular Router?',
            options: ['Para activar animaciones', 'Para proteger una ruta previniendo su carga si no se cumple una condición (Guard)', 'Para activar módulos', 'Para encender el debug'],
        },
        {
            id: 44,
            content: '¿Cómo defines una ruta "comodín" de 404?',
            options: ['{ path: "*", component: ... }', '{ path: "**", component: ... }', '{ path: "404", component: ... }', '{ error: true, component: ... }'],
        },
        {
            id: 45,
            content: '¿Qué es un FormArray?',
            options: ['Un arreglo de primitivos', 'Una clase para gestionar un número dinámico de controles de formulario reactivo', 'Un tipo de input HTML', 'Una variable del componente'],
        },
        {
            id: 46,
            content: '¿Dónde se define típicamente la inyección de servicios a nivel global?',
            options: ['En el constructor', 'providedIn: "root"', 'providers: [] del componente', 'En tsconfig.json'],
        },
        {
            id: 47,
            content: '¿Qué decorador de clase prepara una clase para Inyección de Dependencias?',
            options: ['@Component', '@Injectable()', '@Directive', '@Pipe'],
        },
        {
            id: 48,
            content: '¿En SSR moderno de Angular, qué indica que un código debe correr solo en el cliente?',
            options: ['isPlatformBrowser()', 'if(window)', 'afterNextRender() / afterRender()', 'Todas las anteriores'],
        },
        {
            id: 49,
            content: '¿Qué es TestBed?',
            options: ['Una cama inteligente', 'La clase principal de Angular para configurar e inicializar entornos para pruebas unitarias', 'Un archivo JSON', 'Un comando de la CLI'],
        },
        {
            id: 50,
            content: '¿Qué significa AOT en Angular?',
            options: ['Ahead Of Time (compilación de plantillas a JS durante el build)', 'Angular Object Type', 'Application Output Testing', 'All Override Template'],
        },
    ],
    susieApiUrl: 'http://localhost:8000/susie/api/v1',
    authToken: 'demo-jwt-token-xyz',
};
