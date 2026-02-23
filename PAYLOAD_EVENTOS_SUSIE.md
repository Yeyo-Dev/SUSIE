# 📦 Payload de Eventos (Violaciones de Seguridad) — SUSIE
> **Fecha:** 23 de Febrero de 2026  
> **De:** Equipo SUSIE (Frontend)  
> **Para:** Equipo Backend  
> **Endpoint Destino:** `POST /monitoreo/evidencias/eventos`

Este documento describe la estructura exacta del JSON (payload) que el ecosistema frontend de SUSIE envía en tiempo real al detectar infracciones y comportamientos anómalos durante una sesión de evaluación.

A diferencia del envío de videos o fotos (que usa `multipart/form-data`), **los eventos del navegador (violaciones) se envían como un `application/json` puro**.

---

## Estructura del Payload (`BROWSER_EVENT`)

Este es un ejemplo real del JSON enviado por el frontend cuando un estudiante intenta cambiar de pestaña durante un examen:

```json
{
  "metadata": {
    "meta": {
      "correlation_id": "sess_eval_42_1708456789",
      "exam_id": "abc-123",
      "student_id": "user_789",
      "timestamp": "2026-02-23T18:30:00.000Z",
      "source": "frontend_client_v1"
    },
    "payload": {
      "type": "BROWSER_EVENT",
      "browser_focus": false,
      "trigger": "TAB_SWITCH"
    }
  }
}
```

### Explicación de Campos Clave

#### Nodo `meta` (Agrupación de Sesión)
* **`correlation_id`**: Identificador único de la **sesión en vivo** del estudiante (`examSessionId`). Este ID viaja en todos los eventos, fotos y audios para que el Backend de SUSIE pueda agruparlos lógicamente bajo el mismo contexto de examen.
* **`timestamp`**: Fecha y hora exacta en formato ISO 8601 del momento en que ocurrió la violación.

#### Nodo `payload` (Datos de la Infracción)
* **`type`**: En este caso siempre será `"BROWSER_EVENT"`. Esto le permite al gateway de evidencias distinguir este JSON de un evento multimedia (como `"SNAPSHOT"` o `"AUDIO_CHUNK"`).
* **`browser_focus`**: Booleano (`true`/`false`) indicando si la ventana del examen tenía o no el control (foco) al momento de emitir el evento.
* **`trigger`**: Enum *string* que contiene la **violación exacta** detectada.

---

## Diccionario de Triggers Posibles

Dependiendo de la configuración del examen y el comportamiento del usuario, el campo `trigger` puede contener cualquiera de los siguientes valores:

| Valor `trigger` | ¿Qué significa? | Acción Recomendada por Backend |
|-----------------|-----------------|--------------------------------|
| `"TAB_SWITCH"` | El alumno cambió de pestaña en el navegador, minimizó la ventana de Chrome/Edge, o intentó abrir otra aplicación. | Anotar infracción en historial (`susie_logs`). |
| `"FULLSCREEN_EXIT"` | El usuario o el sistema abandonó el modo "Pantalla Completa" obligatoria antes de finalizar. | Anotar infracción. |
| `"LOSS_FOCUS"` | La ventana actual sigue de frente pero perdió el foco (ej. dio clic en la barra de tareas o en un popup de Windows/Mac). | Registrar evento con menor severidad. |
| `"DEVTOOLS_OPENED"` | Las herramientas de desarrollador web (F12, Inspect Element) fueron abiertas. | **Violación Grave.** |
| `"NAVIGATION_ATTEMPT"` | Intentó retroceder (`Back`) o avanzar (`Forward`) en el historial web, tratando de salir del motor. | Violación de flujo. |
| `"RELOAD_ATTEMPT"` | Presionó `F5`, `Ctrl+R` o el botón de recargar del navegador durante la prueba. | Violación de flujo. |
| `"CLIPBOARD_ATTEMPT"` | Intentó hacer *Copy* (Ctrl+C), *Cut* (Ctrl+X) o *Paste* (Ctrl+V) sobre el contenido del examen. | Violación de Plagio / Propiedad Intelectual. |

---

## Consideraciones para el Equipo de Backend

1. **Recepción Rápida:** Estos eventos se envían de forma asíncrona mediante el `EvidenceService` a medida que ocurren. El endpoint `/monitoreo/evidencias/eventos` debe estar optimizado para aceptar el JSON con `HTTP 201 Created` rápidamente.
2. **No Califica, Sólo Reporta:** El backend debe registrar estos eventos crudos. El motor principal de SUSIE determinará después si se alcanzó el límite cancelatorio (ej. demasiados `"TAB_SWITCH"` reportados).
