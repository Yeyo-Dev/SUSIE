/**
 * Type tests para verificar que los tipos son correctos.
 * Estos tests se verifican en tiempo de compilación solo - no generan código runtime.
 * Se usan para evitar regresiones de tipos en refactorizaciones futuras.
 */

import {
  LoggerFn,
  WebGazerAPI,
  WebGazerPrediction,
  AudioRecordingConfig,
  SessionContextData,
  EnvironmentCheckResult,
  SecurityPoliciesConfig,
  IntervalHandle,
  MediaStreamSource,
  SnapshotCaptureParams,
} from './contracts';

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: LoggerFn type - debe aceptar la firma correcta
// ═══════════════════════════════════════════════════════════════════════════

const testLoggerFn: LoggerFn = (type, msg, details) => {
  console.log(`[${type}] ${msg}`, details);
};

// ✅ Debe compilar - LoggerFn acepta 'info' | 'error' | 'success'
testLoggerFn('info', 'Test message');
testLoggerFn('error', 'Error message', new Error('Test error'));
testLoggerFn('success', 'Success message', { code: 200 });

// ❌ Esto NO debe compilar (type incorrecto)
// @ts-expect-error - 'invalid' no es un tipo válido
testLoggerFn('invalid', 'Test', {});

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: WebGazerAPI - debe tener los métodos esperados
// ═══════════════════════════════════════════════════════════════════════════

const mockWebgazer: WebGazerAPI = {
  setTracker: () => mockWebgazer,
  setRegression: () => mockWebgazer,
  setGazeListener: () => mockWebgazer,
  begin: async () => {},
  resume: () => {},
  pause: () => {},
  end: () => {},
  destroy: () => {},
  showVideoPreview: () => mockWebgazer,
  showPredictionPoints: () => mockWebgazer,
  getCurrentPrediction: () => null,
};

// ✅ Debe compilar - cadena de métodos
mockWebgazer
  .setTracker('TFFacemesh')
  .setRegression('ridge')
  .showVideoPreview(true)
  .showPredictionPoints(true);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: WebGazerPrediction - estructura correcta
// ═══════════════════════════════════════════════════════════════════════════

const testPrediction: WebGazerPrediction = {
  x: 0.5,
  y: 0.5,
  confidence: 0.95,
};

// ✅ Debe compilar
const x: number = testPrediction.x;
const y: number = testPrediction.y;
const confidence: number | undefined = testPrediction.confidence;

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: AudioRecordingConfig - propiedades opcionales
// ═══════════════════════════════════════════════════════════════════════════

const audioConfig1: AudioRecordingConfig = {};
const audioConfig2: AudioRecordingConfig = { bitrate: 32000, chunkIntervalSeconds: 15 };
const audioConfig3: AudioRecordingConfig = { mimeType: 'audio/webm;codecs=opus' };

// ✅ Debe compilar
const bitrate: number | undefined = audioConfig2.bitrate;

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: SessionContextData - estructura de sesión
// ═══════════════════════════════════════════════════════════════════════════

const sessionContext: SessionContextData = {
  examSessionId: 'session-123',
  examId: 'exam-456',
  examTitle: 'Math Final',
  durationMinutes: 60,
  userId: 'user-789',
  userName: 'John Doe',
  assignmentId: 999,
};

// ✅ Debe compilar - userId puede ser string o number
const context2: SessionContextData = {
  examSessionId: 'session-123',
  examId: 456,
  examTitle: 'Math',
  durationMinutes: 60,
  userId: 789, // número
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST 6: EnvironmentCheckResult - resultado de verificación
// ═══════════════════════════════════════════════════════════════════════════

const envCheckPass: EnvironmentCheckResult = {
  passed: true,
};

const envCheckFail: EnvironmentCheckResult = {
  passed: false,
  details: { reason: 'Camera not available' },
  errors: ['No camera detected'],
  warnings: ['Low light detected'],
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST 7: SecurityPoliciesConfig - políticas de seguridad
// ═══════════════════════════════════════════════════════════════════════════

const policies: SecurityPoliciesConfig = {
  requireCamera: true,
  requireMicrophone: true,
  requireFullscreen: true,
  preventTabSwitch: true,
  preventInspection: true,
};

// ✅ Debe compilar - propiedades opcionales
const policies2: SecurityPoliciesConfig = {
  requireCamera: false,
  requireMicrophone: false,
  requireFullscreen: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST 8: IntervalHandle - tipo correcto para setInterval
// ═══════════════════════════════════════════════════════════════════════════

const intervalId: IntervalHandle = setInterval(() => {}, 1000);
clearInterval(intervalId);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 9: MediaStreamSource - MediaStream o null
// ═══════════════════════════════════════════════════════════════════════════

const stream1: MediaStreamSource = null;
// const stream2: MediaStreamSource = new MediaStream(); // Necesitaría runtime

// ═══════════════════════════════════════════════════════════════════════════
// TEST 10: SnapshotCaptureParams - parámetros de captura
// ═══════════════════════════════════════════════════════════════════════════

const snapshot: SnapshotCaptureParams = {
  type: 'SNAPSHOT',
  browser_focus: true,
  gaze_history: [
    { x: 0.5, y: 0.5 },
    { x: 0.6, y: 0.4 },
  ],
};

console.log('✅ All type tests passed at compile time');
