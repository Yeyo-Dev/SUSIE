import { Injectable, signal } from '@angular/core';

/**
 * Servicio simple que mantiene el token de autenticación como signal.
 * 
 * El token se establece desde SusieWrapperComponent (@Input) y se lee desde:
 * - AuthInterceptor (para inyectar Authorization header)
 * - EvidenceService (para requests)
 * - EvidenceQueueService (para retries offline)
 * 
 * NOTA: Este servicio está en 'root' para que sea compartido entre
 * el wrapper y los interceptors.
 */
@Injectable({ providedIn: 'root' })
export class AuthTokenService {
    private readonly _token = signal<string | null>(null);
    private readonly _apiUrl = signal<string | null>(null);

    /** Token de autenticación actual (null si no hay) */
    readonly token = this._token.asReadonly();

    /** URL base del API */
    readonly apiUrl = this._apiUrl.asReadonly();

    /** Establece el token de autenticación */
    setToken(token: string | null): void {
        this._token.set(token);
    }

    /** Establece la URL base del API */
    setApiUrl(url: string | null): void {
        this._apiUrl.set(url ? url.replace(/\/$/, '') : null);
    }

    /** Limpia el token y la URL */
    clear(): void {
        this._token.set(null);
        this._apiUrl.set(null);
    }
}