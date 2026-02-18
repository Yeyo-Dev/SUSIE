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
 * Resultado del paso de consentimiento.
 * Se emite cuando el candidato acepta o rechaza los términos.
 */
export interface ConsentResult {
  accepted: boolean;
  timestamp: string;
  permissionsConsented: ConsentPermission[];
}

/** Permisos individuales que el candidato consiente. */
export type ConsentPermission = 'camera' | 'microphone' | 'biometrics';

// --- NUEVO: Estructuras para el Motor de Examen ---

/**
 * Pregunta individual del examen.
 */
export interface SusieQuestion {
  id: number;
  content: string; // HTML o Texto
  options: string[];
  correctAnswer?: string; // Opcional, para validación en cliente (no recomendado en prod)
}

/**
 * Resultado final del examen entregado por el motor.
 */
export interface ExamResult {
  answers: Record<number, string>; // Map<QuestionId, SelectedOption>
  completedAt: string;
  score?: number; // Si se calcula en el cliente
  metadata?: any;
}

/**
 * Configuración principal de la librería ngx-susie-proctoring.
 * La app host (ej: Chaindrenciales) crea esta configuración y la pasa al <susie-wrapper>.
 */
export interface SusieConfig {
  sessionContext: {
    examSessionId: string; // ID de correlación — vincula todas las evidencias de una sesión
    examId: string;
    examTitle: string; // Título para mostrar en el header
    userId?: string; // Optional for now
    userName?: string;
    durationMinutes: number;
  };
  securityPolicies: {
    requireCamera: boolean;
    requireMicrophone: boolean;
    requireFullscreen: boolean;
    requireConsent?: boolean;        // Mostrar T&C antes del examen
    requireEnvironmentCheck?: boolean; // Verificar entorno antes
    requireBiometrics?: boolean;     // Verificación de identidad facial
    preventTabSwitch?: boolean;      // Detecta cambios de pestaña
    preventInspection?: boolean;     // Bloquea DevTools
    preventBackNavigation?: boolean; // Inyecta history.pushState
    preventPageReload?: boolean;     // Muestra diálogo de confirmación
    preventCopyPaste?: boolean;      // Bloquea copy/cut/paste y selección
  };

  audioConfig?: {
    enabled: boolean;
    chunkIntervalSeconds: number;
    bitrate: number;
  };
  capture?: {
    snapshotIntervalSeconds: number;
  };


  /** 
   * (Opcional) Lista de preguntas para que Susie las renderice con su motor interno (Exam Engine).
   * Si no se provee, Susie asume que el host renderiza el examen (modo legacy/wrapper-only).
   */
  questions?: SusieQuestion[];

  /** Callback invocado al finalizar el examen (submit o timeout) */
  onExamFinished?: (result: ExamResult) => void;

  /** Callback invocado cada vez que se detecta una violación de seguridad */
  onSecurityViolation?: (violation: SecurityViolation) => void;
  /** Callback invocado cuando el candidato acepta o rechaza el consentimiento */
  onConsentResult?: (result: ConsentResult) => void;
  /** Callback para resultados de verificación de entorno */
  onEnvironmentCheckResult?: (result: { passed: boolean; details?: any }) => void;
  /** Callback por inactividad */
  onInactivityDetected?: () => void;
  /** Tiempo en minutos antes de considerar inactivo (default: 3) */
  inactivityTimeoutMinutes?: number;

  debugMode?: boolean; // Mostrar panel de debug
  apiUrl: string;      // URL del API Gateway
  authToken: string;   // JWT del estudiante
}

/**
 * Metadatos que acompañan cada evidencia (snapshot, audio, evento).
 */
export interface EvidenceMetadata {
  meta: {
    correlation_id: string; // examSessionId
    exam_id: string;        // ID del examen
    student_id: string;     // ID del estudiante
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
 * Payload interno del servicio de evidencias.
 */
export interface EvidencePayload {
  metadata: EvidenceMetadata;
  file?: Blob;
}
