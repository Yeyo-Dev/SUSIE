/**
 * Mock Server - Simula el Backend de Chaindrenciales
 * 
 * Uso: npm install express cors body-parser && node mock-chaindrenciales.js
 * 
 * Este servidor simula los 2 endpoints principales que necesitamos:
 * 1. GET /api/evaluaciones/:id/susie-config
 * 2. POST /api/evaluaciones/:id/resultados
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// ============================================
// DATOS MOCK - Reemplazar con llamada a DB real
// ============================================

const EXAM_DATA = {
  examId: 'eval_001',
  examTitle: 'Certificación Angular - Turno Mañana',
  durationMinutes: 30,
  assignmentId: 1,
  userId: 'user_001',
  userName: 'Juan Pérez',
  userEmail: 'juan@email.com',
  questions: [
    {
      id: 1,
      content: '¿Qué es Angular?',
      options: [
        'Un lenguaje de programación',
        'Un framework SPA',
        'Una base de datos',
        'Un sistema operativo'
      ]
    },
    {
      id: 2,
      content: '¿Cuál es el comando para crear un nuevo componente?',
      options: [
        'ng new component',
        'ng g c',
        'ng create component',
        'ng add component'
      ]
    },
    {
      id: 3,
      content: '¿Qué es un Pipe en Angular?',
      options: [
        'Una tubería de datos',
        'Una función que transforma datos en el template',
        'Un tipo de formulario',
        'Un servicio HTTP'
      ]
    }
  ]
};

// ============================================
// ENDPOINT 1: Obtener Configuración del Examen
// ============================================

app.get('/api/evaluaciones/:id/susie-config', (req, res) => {
  console.log(`[GET] /api/evaluaciones/${req.params.id}/susie-config`);
  
  const response = {
    sessionContext: {
      examSessionId: `sesion_${Date.now()}`,
      examId: EXAM_DATA.examId,
      examTitle: EXAM_DATA.examTitle,
      durationMinutes: EXAM_DATA.durationMinutes,
      assignmentId: EXAM_DATA.assignmentId,
      userId: EXAM_DATA.userId,
      userName: EXAM_DATA.userName,
      userEmail: EXAM_DATA.userEmail
    },
    supervision: {
      requireCamera: true,
      requireMicrophone: true,
      requireBiometrics: true,
      requireGazeTracking: false,
      maxTabSwitches: 3,
      inactivityTimeoutMinutes: 5
    },
    questions: EXAM_DATA.questions,
    susieApiUrl: 'http://localhost:8000/susie/api/v1',
    authToken: 'mock-jwt-token-para-susie'
  };
  
  console.log('[RESPONSE] Enviando configuración del examen');
  res.json(response);
});

// ============================================
// ENDPOINT 2: Enviar Resultados del Examen
// ============================================

app.post('/api/evaluaciones/:id/resultados', (req, res) => {
  console.log(`[POST] /api/evaluaciones/${req.params.id}/resultados`);
  console.log('[BODY]', JSON.stringify(req.body, null, 2));
  
  const { status, answers, proctoringSummary } = req.body;
  
  // Simular guardado en DB
  console.log('═══════════════════════════════════════');
  console.log('📋 RESUMEN DEL EXAMEN');
  console.log('═══════════════════════════════════════');
  console.log(`Status: ${status}`);
  console.log(`Total de preguntas respondidas: ${answers?.length || 0}`);
  console.log(`Iniciado: ${req.body.startedAt}`);
  console.log(`Finalizado: ${req.body.finishedAt}`);
  console.log('');
  console.log('📊 RESUMEN DE PROCTORING:');
  console.log(`  - Total violaciones: ${proctoringSummary?.totalViolations || 0}`);
  console.log(`  - Consentimiento: ${proctoringSummary?.consentGiven ? '✓' : '✗'}`);
  console.log(`  - Biometría verificada: ${proctoringSummary?.biometricVerified ? '✓' : '✗'}`);
  console.log(`  - ID Reporte SUSIE: ${proctoringSummary?.susieReportId || 'N/A'}`);
  
  if (proctoringSummary?.violationsByType) {
    console.log('  - Detalle de violaciones:');
    Object.entries(proctoringSummary.violationsByType).forEach(([type, count]) => {
      console.log(`      ${type}: ${count}`);
    });
  }
  console.log('═══════════════════════════════════════');
  
  // Responder éxito
  res.json({
    success: true,
    message: 'Resultados guardados correctamente',
    examId: req.params.id,
    receivedAt: new Date().toISOString()
  });
});

// ============================================
// ENDPOINT 3 (Opcional): Inicio de Sesión
// ============================================

app.post('/api/evaluaciones/:id/sesiones/start', (req, res) => {
  console.log(`[POST] /api/evaluaciones/${req.params.id}/sesiones/start`);
  console.log('[BODY]', req.body);
  
  res.json({
    success: true,
    message: 'Sesión iniciada',
    examSessionId: req.body.examSessionId
  });
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🚀 MOCK CHAINDRENCIALES SERVER');
  console.log('═══════════════════════════════════════════');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('');
  console.log('📌 Endpoints disponibles:');
  console.log(`   GET  /api/evaluaciones/:id/susie-config`);
  console.log(`   POST /api/evaluaciones/:id/resultados`);
  console.log(`   POST /api/evaluaciones/:id/sesiones/start`);
  console.log(`   GET  /health`);
  console.log('');
  console.log('👉 Para probar:');
  console.log(`   curl http://localhost:${PORT}/api/evaluaciones/1/susie-config`);
  console.log('═══════════════════════════════════════════');
});
