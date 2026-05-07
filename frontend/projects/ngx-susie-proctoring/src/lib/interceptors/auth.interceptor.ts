import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';

/**
 * Interceptor funcional que inyecta el header Authorization en las peticiones HTTP.
 * 
 * Lee el token desde AuthTokenService (signal-based) y lo añade como Bearer token.
 * Si no hay token disponible, la petición continúa sin el header.
 * 
 * @example
 * // En app.config.ts:
 * provideHttpClient(
 *   withInterceptors([authInterceptor, errorHandlingInterceptor])
 * )
 */
export const authInterceptor: HttpInterceptorFn = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn
) => {
    const tokenService = inject(AuthTokenService);
    const token = tokenService.token();

    // Si no hay token, continuar sin modificar
    if (!token) {
        return next(req);
    }

    // Clonar la petición con el header Authorization
    const authReq = req.clone({
        setHeaders: {
            Authorization: `Bearer ${token}`
        }
    });

    return next(authReq);
};