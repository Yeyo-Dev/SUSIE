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
  };
  apiUrl: string; // API Gateway URL
  authToken: string; // User JWT
}

export interface EvidenceMetadata {
  meta: {
    correlation_id: string; // = examSessionId
    timestamp: string;      // ISO 8601
    source: 'frontend_client_v1';
  };
  payload: {
    type: 'SNAPSHOT' | 'AUDIO_CHUNK' | 'BROWSER_EVENT' | 'FOCUS_LOST';
    browser_focus: boolean; // Is Tab active?
  };
}

// Payload for internal service usage before FormData serialization
export interface EvidencePayload {
  metadata: EvidenceMetadata;
  file?: Blob;
}
