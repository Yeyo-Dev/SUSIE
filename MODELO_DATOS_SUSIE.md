# Modelo de Datos: Integración SUSIE y Chaindrenciales

Este documento detalla la estructura principal de base de datos en Chaindrenciales (basada en el diagrama ER) que da soporte al motor de proctoring de SUSIE, específicamente para centralizar la telemetría, eventos de sesión y almacenamiento de evidencias.

## 1. Entidades Principales

El flujo de monitoreo se articula alrededor de tres tablas principales, estableciendo una jerarquía clara desde la autorización del examen hasta el registro de anomalías (infracciones).

### `asignacion_examen` (El Contexto / Autorización)
Esta tabla representa el permiso o la invitación para que un candidato realice un examen específico. Es el punto de partida agnóstico al proctoring.
- **`id`** (`bigserial`): Identificador único de la asignación.
- **`usuario_id`** (`bigint`): Referencia al candidato.
- **`examen_id`** (`bigint`): Referencia a la definición del examen en el banco de preguntas.
- **`uuid`** (`varchar`): Identificador público/seguro.
- **`fecha_limite`**: Plazo máximo para realizar el examen.
- **`estado`**: Estado general de la asignación.

> **Contexto Frontend:** El `sessionContext` inyectado en el `<susie-wrapper>` debe contener datos derivados de esta entidad (ej. el `examId` y la validación del usuario).

---

### `sesion_evaluacion` (Registro de Sesión de Monitoreo)
Representa un "intento" o una ejecución física del examen bajo la supervisión de SUSIE. Esta tabla captura el ciclo de vida de la supervisión.
- **`id_sesion`** (`bigint`): Identificador único de la sesión activa en SUSIE (corresponde a nuestro `examSessionId`).
- **`id_asignacion`** (`bigint`): Llave foránea hacia `asignacion_examen`.
- **`fecha_inicio`** (`timestamp`): Poblado por el evento de frontend `startSession`.
- **`fecha_fin`** (`timestamp`): Poblado por el evento de frontend `endSession`.
- **`estado_sesion`** (`varchar`): Estado del intento (ej: `IN_PROGRESS`, `SUBMITTED`, `CANCELLED`).

---

### `infracciones_evaluacion` (Registro de Evidencias y Alertas)
Esta es la tabla fundamental del motor de proctoring, encargada de persistir cada anomalía detectada por los sensores estáticos del frontend o los modelos de IA del Inference Engine.
- **`id_infraccion`** (`bigint`): Identificador único de la alerta.
- **`id_sesion`** (`bigint`): Llave foránea hacia `sesion_evaluacion`. Garantiza que cada infracción pertenezca a un único intento.
- **`tipo_infraccion`** (`varchar`): Identificadores estándar de SUSIE (ej. `TAB_SWITCH`, `FULLSCREEN_EXIT`, `MULTIPLE_FACES`, `NO_FACE_DETECTED`).
- **`minuto_infraccion`** (`varchar`): Marca de tiempo relativa o absoluta de la ocurrencia.
- **`detalles_infraccion`** (`text`): Campo abierto tipo texto (ideal para JSON) que almacena la metadata completa del evento o reporte de inferencia de la IA.
- **`url_azure_evidencia`** (`varchar`): Enlace persistente al archivo multimedia que respalda la infracción (imagen snapshot o clip de audio).

---

## 2. Notas Arquitectónicas Clave

1.  **Almacenamiento en Azure (Blob Storage):** La presencia del campo `url_azure_evidencia` confirma que la infraestructura backend de Chaindrenciales delega el almacenamiento de artefactos (imágenes y audios) a **Microsoft Azure**. 
    - *Impacto Backend:* Todos los endpoints que reciban payloads binarios desde SUSIE (`/monitoreo/snapshot`, `/monitoreo/audio`) deberán implementar la lógica de subida hacia contenedores de Azure Blob Storage y registrar la URL pública/SAS en esta columna.

2.  **Mapeo de Relaciones (Cardinalidad):**
    - `asignacion_examen` (1) ─── (N) `sesion_evaluacion`
    - `sesion_evaluacion` (1) ─── (N) `infracciones_evaluacion`

3.  **Compatibilidad con CONTRATO_INTEGRACION_BACKEND.md:**
    - El esquema JSON diseñado previamente para los eventos `start` y `end` hace coincidencia total (1:1) con las necesidades de mutación de la tabla `sesion_evaluacion`.
    - La integración de alertas (`/monitoreo/alertas`) inserta directamente registros en `infracciones_evaluacion`.
