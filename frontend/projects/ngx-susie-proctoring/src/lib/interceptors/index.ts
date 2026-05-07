/**
 * Interceptors HTTP para ngx-susie-proctoring.
 * 
 * Estos interceptors se registran en la app host via provideHttpClient(withInterceptors([...])).
 */
export { authInterceptor } from './auth.interceptor';
export { errorHandlingInterceptor } from './error-handling.interceptor';