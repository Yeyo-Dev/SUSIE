import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
    BackendEvaluacionResponse,
    BackendExamenResponse,
    ChaindrencialesExamConfig,
    SusieQuestion,
    mapBackendPreguntas,
    mapBackendConfigToSupervision,
} from '../models/contracts';
import { firstValueFrom } from 'rxjs';

/**
 * Servicio que carga la configuración de examen desde el backend de SUSIE.
 *
 * Realiza dos llamadas:
 * 1. GET /evaluaciones/configuracion/:evaluacion_id → config + contexto usuario
 * 2. GET /examenes/:examen_id                       → preguntas del examen
 *
 * Luego mapea ambas respuestas a un ChaindrencialesExamConfig que la app host consume.
 *
 * Uso:
 * ```typescript
 * const configService = inject(ExamConfigService);
 * configService.setBaseUrl('http://localhost:3000/susie/api/v1');
 * await configService.loadConfig('42');
 * const cfg = configService.config(); // ChaindrencialesExamConfig | null
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ExamConfigService {
    private readonly http = inject(HttpClient);

    /** URL base del API de SUSIE (ej: http://localhost:3000/susie/api/v1). */
    private baseUrl = '';

    /** Configuración cargada del API. */
    readonly config = signal<ChaindrencialesExamConfig | null>(null);

    /** Indica si se está cargando la configuración. */
    readonly isLoading = signal(false);

    /** Error de la última carga, si hubo. */
    readonly error = signal<string | null>(null);

    /** Indica si la config ya fue cargada exitosamente. */
    readonly hasConfig = computed(() => this.config() !== null);

    /**
     * Configura la URL base del API.
     * @param url URL base sin trailing slash (ej: 'http://localhost:3000/susie/api/v1')
     */
    setBaseUrl(url: string): void {
        this.baseUrl = url.replace(/\/$/, '');
    }

    /**
     * Carga la configuración de examen desde el backend de SUSIE.
     *
     * Hace dos llamadas en paralelo:
     * - GET /evaluaciones/configuracion/:evaluacionId
     * - GET /examenes/:examenId (obtenido de la primera respuesta)
     *
     * @param evaluacionId ID de la evaluación
     * @returns La config mapeada a ChaindrencialesExamConfig
     * @throws Error si la carga falla
     */
    async loadConfig(evaluacionId: string): Promise<ChaindrencialesExamConfig> {
        this.isLoading.set(true);
        this.error.set(null);

        try {
            // 1. Cargar configuración de la evaluación
            const evalUrl = `${this.baseUrl}/evaluaciones/configuracion/${evaluacionId}`;
            const evalResponse = await firstValueFrom(
                this.http.get<BackendEvaluacionResponse>(evalUrl)
            );

            const eval_ = evalResponse.evaluacion.evaluacion;
            const cfg = evalResponse.evaluacion.configuracion;

            // 2. Cargar preguntas del examen
            const examenUrl = `${this.baseUrl}/examenes/${eval_.examen_id}`;
            const examenResponse = await firstValueFrom(
                this.http.get<BackendExamenResponse>(examenUrl)
            );

            const questions: SusieQuestion[] = mapBackendPreguntas(examenResponse.data.preguntas);

            // 3. Mapear a ChaindrencialesExamConfig
            const mappedConfig: ChaindrencialesExamConfig = {
                sessionContext: {
                    examSessionId: 'pending', // Se reemplaza con el id_sesion real cuando POST /sesiones/ responde
                    examId: eval_.examen_id,
                    examTitle: eval_.examen_titulo,
                    durationMinutes: eval_.duracion_minutos,
                    assignmentId: Number(eval_.asignacion_id),
                    userId: String(eval_.usuario_id),
                    userName: eval_.usuario_nombre,
                },
                supervision: mapBackendConfigToSupervision(cfg),
                questions,
                susieApiUrl: this.baseUrl,
                authToken: '', // Se configura desde la app host
            };

            this.config.set(mappedConfig);
            return mappedConfig;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al cargar configuración del examen';
            this.error.set(message);
            throw new Error(message);
        } finally {
            this.isLoading.set(false);
        }
    }

    /** Limpia la configuración actual. */
    reset(): void {
        this.config.set(null);
        this.error.set(null);
        this.isLoading.set(false);
    }
}
