
// Interfaz para el metadata del evento
export interface MetadataEvento {
    sesion_id: number;
    exam_id: string;
    student_id: string;
    timestamp: number;
}

// Interfaz para el payload del evento
export interface EventoPayloadInfo {
    type: "BROWSER_EVENT";
    trigger:
        | "TAB_SWITCH"
        | "LOSS_FOCUS"
        | "DEVTOOLS_OPENED"
        | "FULLSCREEN_EXIT"
        | "NAVIGATION_ATTEMPT"
        | "RELOAD_ATTEMPT"
        | "CLIPBOARD_ATTEMPT";
    duration_seconds?: number;
}

// Interfaz del body completo que envía el frontend
export interface EventoRequestBody {
    meta: MetadataEvento;
    payload_info: EventoPayloadInfo;
}

// Mapeo de triggers a tipos de infracción para la BD
export const TRIGGER_TO_TIPO_INFRACCION: Record<string, string> = {
    TAB_SWITCH: "CAMBIO_DE_PESTAÑA",
    LOSS_FOCUS: "CAMBIO_DE_PESTAÑA",
    FULLSCREEN_EXIT: "OTRO",
    DEVTOOLS_OPENED: "OTRO",
    NAVIGATION_ATTEMPT: "OTRO",
    RELOAD_ATTEMPT: "OTRO",
    CLIPBOARD_ATTEMPT: "OTRO",
};

// Mapeo de triggers a severidad (para el nodo E de la Red Bayesiana)
export const TRIGGER_DESCRIPTIONS: Record<string, string> = {
    TAB_SWITCH: "El alumno cambió de pestaña",
    LOSS_FOCUS: "El alumno perdió el foco de la ventana",
    FULLSCREEN_EXIT: "El alumno salió de pantalla completa",
    DEVTOOLS_OPENED: "El alumno intentó abrir herramientas de desarrollador",
    NAVIGATION_ATTEMPT: "El alumno intentó navegar fuera de la página",
    RELOAD_ATTEMPT: "El alumno intentó recargar la página",
    CLIPBOARD_ATTEMPT: "El alumno intentó copiar/pegar",
};
