/**
 * Estructura de una violación de seguridad detectada.
 * Se usa para notificar tanto al wrapper (debug panel) como a la app host (cancelar examen).
 */
export interface SecurityViolation {
  type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'FOCUS_LOST';
  message: string;
  timestamp: string;
}

/**
 * Configuración principal de la librería ngx-susie-proctoring.
 * La app host (ej: susie-demo) crea esta configuración y la pasa al <susie-wrapper>.
 */
export interface SusieConfig {
  sessionContext: {
    examSessionId: string; // ID de correlación — vincula todas las evidencias de una sesión
    examId: string;
    durationMinutes: number;
  };
  securityPolicies: {
    requireCamera: boolean;
    requireMicrophone: boolean;
    requireFullscreen: boolean;
    preventTabSwitch?: boolean;     // Detecta cambios de pestaña via Page Visibility API
    preventInspection?: boolean;    // Bloquea DevTools (F12, Ctrl+Shift+I) y clic derecho
    preventBackNavigation?: boolean; // Inyecta history.pushState para bloquear botón atrás
    preventPageReload?: boolean;    // Muestra diálogo de confirmación al recargar/cerrar
  };
  audioConfig?: {
    enabled: boolean;
    chunkIntervalSeconds: number; // Intervalo entre chunks de audio (default: 10s)
    bitrate: number;              // Bitrate del codec de audio (default: 32000 bps)
  };
  /** Callback invocado cada vez que se detecta una violación de seguridad */
  onSecurityViolation?: (violation: SecurityViolation) => void;
  debugMode?: boolean; // Mostrar panel de debug (solo para pruebas, nunca en producción)
  apiUrl: string;      // URL del API Gateway donde se envían las evidencias
  authToken: string;   // JWT del estudiante para autenticación con el backend
}

/**
 * Metadatos que acompañan cada evidencia (snapshot, audio, evento).
 * Este esquema está diseñado para ser compatible con modelos de AI que procesan las evidencias.
 */
export interface EvidenceMetadata {
  meta: {
    correlation_id: string; // examSessionId — vincula todas las evidencias de la misma sesión
    exam_id: string;        // ID del examen — agrupa por tipo de evaluación
    student_id: string;     // ID del estudiante — tracking individual
    timestamp: string;      // ISO 8601
    source: 'frontend_client_v1';
  };
  payload: {
    type: 'SNAPSHOT' | 'AUDIO_CHUNK' | 'BROWSER_EVENT' | 'FOCUS_LOST';
    browser_focus: boolean;    // ¿Está la pestaña activa al momento de capturar?
    keyboard_events?: number;  // Contador acumulado de teclas presionadas
    tab_switches?: number;     // Cantidad de cambios de pestaña detectados
  };
}

/**
 * Payload interno del servicio de evidencias, antes de serializar a FormData.
 * Separa metadata (JSON) del archivo binario (Blob) para envío multipart.
 */
export interface EvidencePayload {
  metadata: EvidenceMetadata;
  file?: Blob;
}
