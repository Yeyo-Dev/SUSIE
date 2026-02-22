import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChaindrencialesExamConfig } from '../models/contracts';
import { firstValueFrom } from 'rxjs';

/**
 * Servicio que carga la configuración de examen desde el API de Chaindrenciales.
 *
 * Uso:
 * ```typescript
 * const configService = inject(ExamConfigService);
 * configService.setBaseUrl('https://api.chaindrenciales.com');
 * await configService.loadConfig('42');
 * const cfg = configService.config(); // ChaindrencialesExamConfig | null
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ExamConfigService {
    private readonly http = inject(HttpClient);

    /** URL base del API de Chaindrenciales. */
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
     * @param url URL base sin trailing slash (ej: 'https://api.chaindrenciales.com')
     */
    setBaseUrl(url: string): void {
        this.baseUrl = url.replace(/\/$/, '');
    }

    /**
     * Carga la configuración de examen desde Chaindrenciales.
     * @param evaluacionId ID de la evaluación
     * @returns La config cargada
     * @throws Error si la carga falla
     */
    async loadConfig(evaluacionId: string): Promise<ChaindrencialesExamConfig> {
        this.isLoading.set(true);
        this.error.set(null);

        try {
            const url = `${this.baseUrl}/api/evaluaciones/${evaluacionId}/susie-config`;
            const config = await firstValueFrom(
                this.http.get<ChaindrencialesExamConfig>(url)
            );
            this.config.set(config);
            return config;
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
