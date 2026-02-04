export interface SusieConfig {
    sessionContext: {
        examSessionId: string; // ID único para trazabilidad (Correlation ID)
        examId: string;
        durationMinutes?: number; // Duración del examen en minutos
    };
    securityPolicies: {
        requireCamera: boolean;
        requireFullscreen: boolean;
        requireMicrophone: boolean;
    };
    apiUrl: string; // URL del API Gateway al que debo enviar las fotos
    authToken: string; // JWT del usuario
}

export interface EvidencePayload {
    meta: {
        correlation_id: string; // Debe coincidir con examSessionId
        timestamp: string;      // ISO 8601
        source: 'frontend_client_v1';
    };
    payload: {
        type: 'SNAPSHOT' | 'AUDIO_CHUNK' | 'FOCUS_LOST';
        browser_focus: boolean;
        resource_file?: Blob; // Archivo binario opcional (foto o audio)
    };
}
