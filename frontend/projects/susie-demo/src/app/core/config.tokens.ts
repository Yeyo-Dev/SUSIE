import { InjectionToken } from '@angular/core';

export const SUSIE_API_URL = new InjectionToken<string>('SUSIE_API_URL');
export const EVALUACION_ID = new InjectionToken<string>('EVALUACION_ID');

// NOTA: AUTH_TOKEN eliminado - el token ahora se pasa via @Input() al SusieWrapperComponent
