export interface EventoDataContent {
    id_sesion: bigint;
    timestamp: number;
    tipo_evento: "CAMBIO_DE_PESTAÑA" | "PERDIDA_DE_FOCO" | "HERRAMIENTAS_DE_DESARROLLADOR" | "SALIDA_DE_PANTALLA_COMPLETA";
    minuto_inicio: string;
}
