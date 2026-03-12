/**
 * Estructura de una violación de seguridad detectada.
 * Se usa para notificar tanto al wrapper (debug panel) como a la app host (cancelar examen).
 */
export interface SecurityViolation {
  type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'FOCUS_LOST' | 'INSPECTION_ATTEMPT' | 'NAVIGATION_ATTEMPT' | 'RELOAD_ATTEMPT' | 'CLIPBOARD_ATTEMPT' | 'GAZE_DEVIATION';
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

/** Información de un paso en el indicador dinámico del flujo de proctoring. */
export interface StepInfo {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
}

// --- NUEVO: Estructuras para el Motor de Examen ---

/**
 * Pregunta individual del examen.
 */
export interface SusieQuestion {
  id: number;
  content: string; // HTML o Texto
  options: string[];
  /** URL de imagen asociada a la pregunta (puede ser null). */
  image?: string | null;
  /** Opcional — la corrección real ocurre en el servidor. No enviar en producción. */
  correctAnswer?: string;
}

// --- Backend API Response Contracts (api_docs.md) ---

/** Respuesta de GET /evaluaciones/configuracion/:evaluacion_id */
export interface BackendEvaluacionResponse {
  success: boolean;
  evaluacion: {
    evaluacion: {
      examen_id: string;
      examen_titulo: string;
      duracion_minutos: number;
      asignacion_id: string;
      usuario_id: string;
      usuario_nombre: string;
      usuario_email: string;
    };
    configuracion: {
      analisis_mirada: boolean;
      camara: boolean;
      max_cambio_pestana: number;
      microfono: boolean;
      tiempo_sin_inactividad: number;
      tolerancia_desconexion: number;
      validacion_biometrica: boolean;
    };
  };
}

/** Respuesta de GET /examenes/:examen_id */
export interface BackendExamenResponse {
  success: boolean;
  data: {
    detalles: {
      examen_id: string;
      titulo: string;
      descripcion: string;
      numero_de_preguntas: string;
      puntos_maximos: string;
    };
    preguntas: {
      pregunta_id: string;
      contenido: string;
      imagen: string | null;
      opciones: string[];
    }[];
  };
}

/** Respuesta de POST /sesiones/ */
export interface BackendSesionResponse {
  id_sesion: string;
  id_asignacion: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado_sesion: 'EN_CURSO' | 'FINALIZADA';
}

/** Respuesta de POST /sesiones/finalizar/:id_sesion */
export interface BackendSesionFinalizadaResponse {
  id_sesion: string;
  estado_sesion: 'FINALIZADA';
  fecha_fin: string;
}

/** Enum de tipos de infracción conocidos por el backend */
export type BackendInfraccionTipo = 'CAMBIO_DE_PESTAÑA' | 'USO_DE_TELEFONO' | 'OTRO';

/** Payload de POST /monitoreo/infracciones/ */
export interface BackendInfraccionPayload {
  id_sesion: number;
  minuto_infraccion: string; // Formato "HH:MM:SS"
  tipo_infraccion: BackendInfraccionTipo;
  detalles_infraccion: string;
  url_azure_evidencia?: string | null;
}

/**
 * Resultado final del examen entregado por el motor.
 */
export interface ExamResult {
  answers: Record<number, string>; // Map<QuestionId, SelectedOption>
  completedAt: string;
  score?: number; // Si se calcula en el cliente
  metadata?: Record<string, unknown>;
  /** Resumen de métricas de supervisión recopiladas durante la sesión. */
  proctoringSummary?: {
    totalViolations: number;
    tabSwitches: number;
    snapshots: {
      /** Fotos de verificación de identidad (durante setup). */
      biometric: number;
      /** Fotos periódicas enviadas al modelo YOLO durante el examen. */
      monitoring: number;
    };
  };
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
    userId?: string;
    userName?: string;
    durationMinutes: number;
    /** ID de la asignación en la plataforma host (ej. Chaindrenciales). */
    assignmentId?: number;
    /** ID de la sesión remota asignada por el backend al iniciar (POST /sesiones/). */
    remoteSessionId?: string;
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
    requireGazeTracking?: boolean;   // Activar seguimiento ocular con WebGazer
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
  onEnvironmentCheckResult?: (result: EnvironmentCheckResult) => void;
  /** Callback por inactividad */
  onInactivityDetected?: () => void;
  /** Tiempo en minutos antes de considerar inactivo (default: 3) */
  inactivityTimeoutMinutes?: number;
  /** Máximo de cambios de pestaña permitidos antes de cancelar (0 = cancelar al primero) */
  maxTabSwitches?: number;

  debugMode?: boolean; // Mostrar panel de debug
  apiUrl: string;      // URL del API Gateway
  authToken: string;   // JWT del estudiante
}

// --- Integración con Chaindrenciales ---

/**
 * Los 6 campos configurables por examen.
 * Todo lo demás (fullscreen, preventCopyPaste, etc.) lo maneja SUSIE internamente.
 */
export interface SupervisionConfig {
  requireCamera: boolean;
  requireMicrophone: boolean;
  requireBiometrics: boolean;
  requireGazeTracking: boolean;
  /** Máximo de cambios de pestaña permitidos (0 = cancelar al primero). */
  maxTabSwitches: number;
  /** Minutos sin actividad antes de alertar. */
  inactivityTimeoutMinutes: number;
}

/**
 * Contrato de lo que el endpoint de Chaindrenciales nos devuelve.
 * GET /api/evaluaciones/:evaluacionId/susie-config
 */
export interface ChaindrencialesExamConfig {
  sessionContext: {
    examSessionId: string;
    examId: string;
    examTitle: string;
    durationMinutes: number;
    assignmentId: number;
    userId?: string;
    userName?: string;
  };
  supervision: SupervisionConfig;
  questions: SusieQuestion[];
  susieApiUrl: string;
  authToken: string;
}

/**
 * Transforma la respuesta de Chaindrenciales → SusieConfig interna.
 * Deriva las políticas siempre-ON y configura audio/consent automáticamente.
 */
export function mapToSusieConfig(
  source: ChaindrencialesExamConfig,
  callbacks?: {
    onSecurityViolation?: (v: SecurityViolation) => void;
    onExamFinished?: (r: ExamResult) => void;
    onConsentResult?: (r: ConsentResult) => void;
    onEnvironmentCheckResult?: (r: { passed: boolean }) => void;
    onInactivityDetected?: () => void;
  },
  options?: { debugMode?: boolean }
): SusieConfig {
  const s = source.supervision;
  // Si hay cámara → biometría implícita (verificar identidad si te estamos grabando)
  const requireBiometrics = s.requireBiometrics || s.requireCamera;
  const needsConsent = s.requireCamera || s.requireMicrophone || requireBiometrics;

  return {
    sessionContext: {
      examSessionId: source.sessionContext.examSessionId,
      examId: source.sessionContext.examId,
      examTitle: source.sessionContext.examTitle,
      durationMinutes: source.sessionContext.durationMinutes,
      assignmentId: source.sessionContext.assignmentId,
      userId: source.sessionContext.userId,
      userName: source.sessionContext.userName,
    },
    securityPolicies: {
      // Configurables (vienen de BD)
      requireCamera: s.requireCamera,
      requireMicrophone: s.requireMicrophone,
      requireBiometrics: requireBiometrics,
      requireGazeTracking: s.requireGazeTracking,
      // Derivados
      requireConsent: needsConsent,
      requireEnvironmentCheck: s.requireCamera,
      // Siempre ON (base de SUSIE)
      requireFullscreen: true,
      preventTabSwitch: true,
      preventInspection: true,
      preventBackNavigation: true,
      preventPageReload: true,
      preventCopyPaste: true,
    },
    audioConfig: {
      enabled: s.requireMicrophone,
      chunkIntervalSeconds: 15,
      bitrate: 32000,
    },
    capture: {
      snapshotIntervalSeconds: 5,
    },
    questions: source.questions,
    maxTabSwitches: s.maxTabSwitches,
    inactivityTimeoutMinutes: s.inactivityTimeoutMinutes,
    apiUrl: source.susieApiUrl,
    authToken: source.authToken,
    debugMode: options?.debugMode ?? false,
    ...callbacks,
  };
}

// --- Evidencias ---

/**
 * Metadatos que acompañan cada evidencia (snapshot, audio, evento).
 * Estructura alineada al contrato del backend (api_docs.md).
 */
export interface EvidenceMetadata {
  /** Metadatos de contexto de la sesión (campo `meta` en FormData). */
  meta: {
    sesion_id: number;        // ID de sesión remota (obtenido de POST /sesiones/)
    usuario_id: number;       // ID numérico del usuario
    nombre_usuario: string;   // Nombre completo del usuario
    examen_id: number;        // ID numérico del examen
    nombre_examen: string;    // Título del examen
    timestamp: number;        // Unix timestamp en ms (Date.now())
    /** Solo para audios: índice secuencial del fragmento. */
    fragmento_indice?: number;
  };
  /** Info del tipo de payload (campo `payload_info` en FormData). */
  payload_info: {
    type: 'snapshot_webcam' | 'snapshot_pantalla' | 'audio_segment';
    source: 'web' | 'desktop' | 'microphone' | 'webcam';
  };
  /** Campos internos del frontend (NO se envían al backend, uso local). */
  _internal?: {
    /** Tipo interno de evidencia (alias: originalType o type). */
    type: 'SNAPSHOT' | 'AUDIO_CHUNK' | 'BROWSER_EVENT' | 'FOCUS_LOST';
    browser_focus: boolean;
    trigger?: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'DEVTOOLS_OPENED' | 'LOSS_FOCUS' | 'NAVIGATION_ATTEMPT' | 'RELOAD_ATTEMPT' | 'CLIPBOARD_ATTEMPT' | 'GAZE_DEVIATION';
    keyboard_events?: number;
    tab_switches?: number;
    gaze_history?: { x: number; y: number; ts: number }[];
  };
}

/**
 * Payload interno del servicio de evidencias.
 */
export interface EvidencePayload {
  metadata: EvidenceMetadata;
  file?: Blob;
}

// --- Utilidades de mapeo backend ---

/**
 * Mapea preguntas del formato backend a SusieQuestion.
 */
export function mapBackendPreguntas(
  preguntas: BackendExamenResponse['data']['preguntas']
): SusieQuestion[] {
  return preguntas.map(p => ({
    id: Number(p.pregunta_id),
    content: p.contenido,
    options: p.opciones,
    image: p.imagen,
  }));
}

/**
 * Mapea la configuración del backend a SupervisionConfig.
 */
export function mapBackendConfigToSupervision(
  cfg: BackendEvaluacionResponse['evaluacion']['configuracion']
): SupervisionConfig {
  return {
    requireCamera: cfg.camara,
    requireMicrophone: cfg.microfono,
    requireBiometrics: cfg.validacion_biometrica,
    requireGazeTracking: cfg.analisis_mirada,
    maxTabSwitches: cfg.max_cambio_pestana,
    inactivityTimeoutMinutes: cfg.tiempo_sin_inactividad / 60, // backend envía en segundos
  };
}

/**
 * Calcula el minuto de infracción en formato "HH:MM:SS" relativo al inicio de la sesión.
 */
export function calcularMinutoInfraccion(sessionStartTime: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - sessionStartTime.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// --- TYPE INTERFACES (Remover `any` types) ---

/**
 * Firma de función logger reutilizada en múltiples servicios.
 * Reemplaza: (type: 'info' | 'error' | 'success', msg: string, details?: any) => void
 * 
 * El parámetro details puede ser cualquier valor porque logger es para debug.
 * Si necesitas validar datos, usa EnvironmentCheckResult u otros tipos específicos.
 */
export type LoggerFn = (
  type: 'info' | 'error' | 'success',
  msg: string,
  details?: unknown
) => void;

/**
 * Datos de predicción de gaze devueltos por WebGazer.
 * Estructura interna de WebGazer - puede tener x, y, confidence, etc.
 */
export interface WebGazerPrediction {
  x: number;
  y: number;
  confidence?: number;
}

/**
 * API pública de WebGazer (biblioteca externa de gaze tracking).
 * Define los métodos que usamos para initializar y usar WebGazer.
 */
export interface WebGazerAPI {
  // Configuración
  setTracker(tracker: 'TFFacemesh' | 'webgazer' | string): WebGazerAPI;
  setRegression(method: 'ridge' | 'linear' | string): WebGazerAPI;
  setGazeListener(callback: (data: WebGazerPrediction | null, clock: number) => void): WebGazerAPI;

  // Control de lifecycle
  begin(): Promise<void>;
  resume(): void;
  pause(): void;
  end(): void;
  destroy(): void;

  // UI
  showVideoPreview(show: boolean): WebGazerAPI;
  showPredictionPoints(show: boolean): WebGazerAPI;

  // Acceso a datos
  getCurrentPrediction(): WebGazerPrediction | null;
}

/**
 * Configuración de grabación de audio (para MediaRecorder).
 * Reemplaza: config: any en startAudioRecording() e initMediaRecorder()
 */
export interface AudioRecordingConfig {
  /** Bitrate en bits por segundo (default: 32000) */
  bitrate?: number;
  /** Intervalo de duración de cada chunk en segundos (default: 15) */
  chunkIntervalSeconds?: number;
  /** MIME type para la grabación (e.g., 'audio/webm;codecs=opus') */
  mimeType?: string;
}

/**
 * Contexto de sesión que identifica un examen y el candidato.
 * Reemplaza: private sessionContext: any = {} en EvidenceService
 */
export interface SessionContextData {
  examSessionId?: string;
  examId?: string | number;
  examTitle?: string;
  userId?: string | number;
  userName?: string;
  durationMinutes?: number;
  assignmentId?: number;
  remoteSessionId?: string;
}

/**
 * Configuración de políticas de seguridad del proctoring.
 * Reemplaza: private policies: any en SecurityService
 */
export interface SecurityPoliciesConfig {
  requireCamera?: boolean;
  requireMicrophone?: boolean;
  requireFullscreen?: boolean;
  requireConsent?: boolean;
  requireEnvironmentCheck?: boolean;
  requireBiometrics?: boolean;
  preventTabSwitch?: boolean;
  preventInspection?: boolean;
  preventBackNavigation?: boolean;
  preventPageReload?: boolean;
  preventCopyPaste?: boolean;
  requireGazeTracking?: boolean;
}

/**
 * Resultado de verificación de entorno de prueba.
 * Reemplaza: details?: any en onEnvironmentCheckResult callback
 */
export interface EnvironmentCheckResult {
  passed: boolean;
  details?: Record<string, unknown>;
  errors?: string[];
  warnings?: string[];
}

/**
 * Stream de medios (video/audio) tipado.
 * MediaStream es nativamente tipado en TS, pero explicitamos aquí para claridad.
 */
export type MediaStreamSource = MediaStream | null;

/**
 * Tipo de intervalo devuelto por setInterval (NodeJS.Timeout).
 * Reemplaza: private snapshotInterval: any = null
 */
export type IntervalHandle = ReturnType<typeof setInterval>;

/**
 * Información de error de MediaRecorder.
 * Reemplaza: (event: any) en mediaRecorder.onerror
 */
export interface MediaRecorderErrorEvent extends Event {
  error: DOMException;
}

/**
 * Parámetros para snapshot capture (modo monitoreo).
 * Abstrae los detalles de captura de pantalla.
 */
export interface SnapshotCaptureParams {
  type: 'SNAPSHOT' | 'BROWSER_EVENT' | 'FOCUS_LOST';
  browser_focus: boolean;
  file?: Blob;
  gaze_history?: Array<{ x: number; y: number }>;
  trigger?: SecurityViolation['type'];
}
