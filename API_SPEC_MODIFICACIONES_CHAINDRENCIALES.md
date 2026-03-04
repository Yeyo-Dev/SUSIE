# 📋 Modificaciones y Nuevos Requerimientos API — Chaindrenciales
> **Fecha:** 22 de Febrero de 2026  
> **De:** Equipo SUSIE (Frontend)  
> **Para:** Equipo Chaindrenciales (Backend)  
> **Propósito:** Listado de **nuevos campos** y modificaciones que deben integrarse en la base de datos y endpoints de Chaindrenciales.

Este documento complementa la especificación original de integración (`API_SPEC_CHAINDRENCIALES.md`), habiendo sido validado contra el esquema de Base de Datos actual (`Diagrama - Modelado datos.pdf`).

---

## 1. Cambios requeridos en la Base de Datos

Tras verificar el esquema ER de la plataforma, tenemos excelentes noticias: **la tabla `configuracion_examen` ya contiene el campo `MaxCambioPesta` y todos los demás campos de seguridad necesarios**. NO es necesario crear nuevas tablas para la seguridad de SUSIE.

Los **únicos dos cambios** a nivel tabla que necesita Chaindrenciales son:

| Tabla | Nueva Columna | Tipo Soportado | Razón / Descripción |
|-------|---------------|----------------|---------------------|
| `examenes` | `duracion_minutos` | `INT` | Tiempo máximo del examen en minutos. El frontend de SUSIE requiere este dato explícito para visualizar y manejar el temporizador en pantalla. |
| `asignacion_examen` | `susie_report_id` | `VARCHAR(100)` | ID del reporte final generado por SUSIE para guardarlo junto con las respuestas del usuario y poder consultar el veredicto más tarde. |

---

## 2. Modificaciones al Payload JSON (Endpoint de Configuración)

El endpoint actual (`GET /api/evaluaciones/:evaluacionId/susie-config`) ya casi cuenta con toda la información, pero debe actualizarse para devolver o mapear los campos faltantes basándose en el esquema ER:

```diff
 {
   "sessionContext": {
     "examSessionId": "sess_eval_42_1708456789", // Generado
     "examId": "abc-123",                       // Desde examenes.id
     "examTitle": "Certificación Angular v20",  // Desde examenes.titulo
+    "durationMinutes": 30,                     // Desde examenes.duracion_minutos (¡NUEVO CAMPO!)
+    "assignmentId": 42                         // Desde asignacion_examen.id (¡CORRECCIÓN!)
   },
   "supervision": {
     "requireCamera": true,                     // Desde configuracion_examen.camara
     "requireMicrophone": true,                 // Desde configuracion_examen.microfono
     "requireBiometrics": false,                // Desde configuracion_examen.validacion_biometrica
     "requireGazeTracking": false,              // Desde configuracion_examen.analisis_mirada
+    "maxTabSwitches": 3,                       // Desde configuracion_examen.MaxCambioPesta (¡MAPEO!)
     "inactivityTimeoutMinutes": 5              // Desde configuracion_examen.tiempo_sin_inactividad
   },
   ...
 }
```

### Aclaración de Entidades vs Nombres
Tomen especial atención en mapear el **ID Principal de la tabla `asignacion_examen` (su PK `id`) al campo `"assignmentId"` del JSON**. Habíamos referenciado previamente la tabla "evaluaciones", pero el diagrama confirma que el nombre real es `asignacion_examen`.

---

## 3. Manejo de Evidencias y Envío de Resultados finales

**Aclaración Crítica de Arquitectura:**
El backend de *Chaindrenciales* **NO** se encargará de recibir, almacenar ni procesar las fotos, audios ni los eventos de violaciones (Browser Events) segundo a segundo. Toda esa telemetría viaja directamente desde el navegador del alumno hacia el backend de **SUSIE Gateway (`/monitoreo/evidencias/eventos`)**.

**El POST final a Chaindrenciales (`POST /api/evaluaciones/:evaluacionId/resultados`):**
Cuando el candidato termina o se le cancela la prueba, SUSIE hace un único POST a Chaindrenciales enviando las `answers` para que se guarden en `respuesta_usuario`. En ese mismo JSON llegará el `proctoring.susieReportId`, el cual ustedes deben persistir en el nuevo campo `asignacion_examen.susie_report_id`.
