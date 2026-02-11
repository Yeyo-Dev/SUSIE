export interface SusieConfig {
  sessionContext: {
    examSessionId: string; // Correlation ID (Vital for traceability)
    examId: string;
    durationMinutes: number;
  };
  securityPolicies: {
    requireCamera: boolean;
    requireMicrophone: boolean;
    requireFullscreen: boolean;
    preventTabSwitch?: boolean;
    preventInspection?: boolean;
  };
  audioConfig?: {
    enabled: boolean;
    chunkIntervalSeconds: number; // Default: 10
    bitrate: number; // Default: 32000
  };
  debugMode?: boolean; // Mostrar panel de debug (solo para pruebas)
  apiUrl: string; // API Gateway URL
  authToken: string; // User JWT
}

export interface EvidenceMetadata {
  meta: {
    correlation_id: string; // Session ID único (examSessionId)
    exam_id: string;        // ID del examen (para agrupar por tipo de examen)
    student_id: string;     // ID del estudiante (para tracking individual)
    timestamp: string;      // ISO 8601
    source: 'frontend_client_v1';
  };
  payload: {
    type: 'SNAPSHOT' | 'AUDIO_CHUNK' | 'BROWSER_EVENT' | 'FOCUS_LOST';
    browser_focus: boolean;    // ¿Está la pestaña activa?
    keyboard_events?: number;  // Contador de eventos de teclado (opcional)
    tab_switches?: number;     // Número de cambios de pestaña (opcional)
  };
}

// Payload for internal service usage before FormData serialization
export interface EvidencePayload {
  metadata: EvidenceMetadata;
  file?: Blob;
}
