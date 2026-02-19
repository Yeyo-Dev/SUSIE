// Metadatos del fragmento de audio
export interface AudioMetadata {
    sesion_id: string| number;
    usuario_id: number;
    nombre_usuario: string;
    examen_id: string;
    nombre_examen: string;
    timestamp: number;
    fragmento_indice: number; //Para el orden de los audios
}

// Tipo de evidencia
export interface AudioPayloadInfo {
    type: 'audio_segment';
    source: 'microphone' | 'webcam';
}