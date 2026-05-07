import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NetworkMonitorService } from '../services/network-monitor.service';

/**
 * Interceptor para atrapar caídas de red o tokens expirados (Graceful Degradation).
 */
export const errorHandlingInterceptor: HttpInterceptorFn = (req, next) => {
  const networkService = inject(NetworkMonitorService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el servidor está caído (0), no estamos autorizados (401) o crasheó el backend (500)
      if (error.status === 0 || error.status === 401 || error.status === 403 || error.status >= 500) {
        networkService.triggerConnectionError(error.status);
      }
      return throwError(() => error);
    })
  );
};
