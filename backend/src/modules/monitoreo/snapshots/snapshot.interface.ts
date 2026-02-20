// Metadatos del video
export interface SnapshotMetadata {
    sesion_id: number;
    usuario_id: number;
    nombre_usuario: string;
    examen_id: number;
    nombre_examen: string;
    timestamp: number;
}

// Tipo de evidencia
export interface SnapshotPayloadInfo {
    type: 'snapshot_webcam' | 'snapshot_pantalla';
    source: 'web' | 'desktop';
}