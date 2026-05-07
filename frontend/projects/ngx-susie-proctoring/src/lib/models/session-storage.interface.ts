/**
 * Interfaces y constantes para la persistencia de sesión.
 * Permite recuperar el estado del examen después de un crash del navegador.
 */
import { ProctoringState } from '@lib/services/proctoring-orchestrator.service';
import { GazeCalibrationMetrics } from '@lib/services/gaze/gaze.interfaces';

/**
 * Estado completo de una sesión de examen que puede ser persistido
 * y recuperado después de un crash del navegador.
 */
export interface PersistedSessionState {
  // === Identidad (para validación de sesión) ===
  /** ID primario — debe coincidir con config.sessionContext.examSessionId */
  examSessionId: string;
  
  /** ID del usuario (opcional, para compatibilidad) */
  userId?: string;
  
  /** ID del examen */
  examId: string;

  // === Progreso del Examen ===
  /** Mapa de respuestas: questionId → selectedOptionId */
  answers: Record<number, string>;
  
  /** Índice de la pregunta actual (0-based) */
  currentQuestionIndex: number;
  
  /** Segundos restantes calculados al momento de persistir */
  timerSecondsRemaining: number;
  
  /** Timestamp ISO de cuando inició el examen (para cálculo de tiempo real) */
  examStartedAt: string;

  // === Estado de Proctoring ===
  /** Posición actual en la máquina de estados */
  proctoringState: ProctoringState;
  
  /** Contador total de violaciones de seguridad */
  totalViolations: number;
  
  /** Contador de cambios de pestaña/tab */
  tabSwitchCount: number;
  
  /** ID de sesión remota asignado por el backend (POST /sesiones/) */
  remoteSessionId: string | null;

  // === Calibración de Gaze (opcional) ===
  /** Datos de calibración de gaze tracking si estaban activos */
  gazeCalibrationData?: GazeCalibrationMetrics;

  // === Metadata ===
  /** Timestamp ISO de la última persistencia */
  persistedAt: string;
  
  /** Versión del schema para futuras migraciones */
  version: number;
}

/** Versión actual del schema — incrementar en cambios breaking */
export const SESSION_STATE_VERSION = 1;

/** Nombre del object store en IndexedDB para el estado de sesión */
export const SESSION_STATE_STORE = 'session_state';

/**
 * Valida que una sesión persistida coincida con el contexto actual del examen.
 * Previene contaminación cruzada entre diferentes exámenes.
 */
export function isSessionRecoverable(
  state: PersistedSessionState | null,
  currentExamSessionId: string,
  durationMinutes: number
): boolean {
  if (!state) return false;
  
  // El ID de sesión debe coincidir exactamente
  if (state.examSessionId !== currentExamSessionId) return false;
  
  // Verificar si el tiempo del examen ha expirado desde la persistencia
  const startedAt = new Date(state.examStartedAt).getTime();
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const originalDuration = durationMinutes * 60;
  
  // Si ya pasó más tiempo que la duración original, el examen está expirado
  if (elapsed >= originalDuration) return false;
  
  return true;
}

/**
 * Calcula el tiempo restante basado en el timestamp de inicio.
 * Usa el tiempo real transcurrido en lugar del valor almacenado.
 */
export function calculateRemainingTime(
  state: PersistedSessionState,
  durationMinutes: number
): number {
  const startedAt = new Date(state.examStartedAt).getTime();
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const originalDuration = durationMinutes * 60;
  return Math.max(0, originalDuration - elapsed);
}