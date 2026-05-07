import { Injectable, inject, isDevMode } from '@angular/core';
import { AuthTokenService } from './auth-token.service';

/**
 * Servicio de logging con filtrado por entorno.
 * 
 * - En desarrollo: todos los logs aparecen en consola
 * - En producción: los logs se suprimen (no salen en el bundle)
 * 
 * Uso:
 * ```typescript
 * private readonly logger = inject(LoggerService);
 * this.logger.log('Mensaje', data);
 * this.logger.warn('Advertencia', data);
 * this.logger.error('Error', error);
 * this.logger.debug('Debug info', data);
 * ```
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
    private readonly tokenService = inject(AuthTokenService);
    
    /** Indica si estamos en modo desarrollo (logs habilitados) */
    private readonly isDev = !this.isProduction();
    
    /** Flag para habilitar logs de debug específicos (gaze, etc.) */
    private debugEnabled = false;

    /**
     * Log informativo (solo en desarrollo).
     */
    log(message: string, ...optionalParams: unknown[]): void {
        if (this.isDev) {
            console.log(`[SUSIE] ${message}`, ...optionalParams);
        }
    }

    /**
     * Log de advertencia (solo en desarrollo).
     */
    warn(message: string, ...optionalParams: unknown[]): void {
        if (this.isDev) {
            console.warn(`[SUSIE] ${message}`, ...optionalParams);
        }
    }

    /**
     * Log de error (solo en desarrollo).
     * NOTA: Los errores críticos podrían enviarse a un servicio de monitoreo en producción.
     */
    error(message: string, ...optionalParams: unknown[]): void {
        if (this.isDev) {
            console.error(`[SUSIE] ${message}`, ...optionalParams);
        }
    }

    /**
     * Log de debug (solo cuando está habilitado explícitamente).
     * Usado para trazas detalladas como gaze tracking.
     */
    debug(message: string, ...optionalParams: unknown[]): void {
        if (this.isDev && this.debugEnabled) {
            console.debug(`[SUSIE-DEBUG] ${message}`, ...optionalParams);
        }
    }

    /**
     * Habilita los logs de debug.
     * Solo debe llamarse cuando el usuario/admin lo solicite explícitamente.
     */
    enableDebug(): void {
        this.debugEnabled = true;
    }

    /**
     * Deshabilita los logs de debug.
     */
    disableDebug(): void {
        this.debugEnabled = false;
    }

    /**
     * Determina si estamos en producción.
     */
    private isProduction(): boolean {
        return !isDevMode();
    }
}