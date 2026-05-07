import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { environment } from '../environments/environment';
import { SUSIE_API_URL, EVALUACION_ID } from './core/config.tokens';
import { authInterceptor, errorHandlingInterceptor } from 'ngx-susie-proctoring';

export const appConfig: ApplicationConfig = {
    providers: [
        provideHttpClient(
            withInterceptors([authInterceptor, errorHandlingInterceptor])
        ),
        { provide: SUSIE_API_URL, useValue: environment.apiUrl },
        { provide: EVALUACION_ID, useValue: environment.evaluacionDemoId }
    ]
};
