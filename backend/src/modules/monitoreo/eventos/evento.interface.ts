//
export interface MetadataEvento {
    sesion_id: number;
    exam_id: string;
    student_id: string;
    timestamp: number;
}

export interface EventoPayloadInfo {
    type: "BROWSER_EVENT";
    trigger: "TAB_SWITCH" | "LOSS_FOCUS" | "DEVTOOLS_OPENED" | "FULLSCREEN_EXIT";
    duration_seconds?: number;
}
