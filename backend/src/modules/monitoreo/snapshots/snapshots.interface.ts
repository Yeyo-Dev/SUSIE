// Metadatos del video
export interface SnapshotMetadata {
    usuario_id: number;
    nombre_usuario: string;
    examen_id: string;
    nombre_examen: string;
    timestamp: number;
}

// Tipo de evidencia
export interface SnapshotPayloadInfo {
    type: 'snapshot_webcam' | 'snapshot_pantalla';
    source: 'web' | 'desktop';
}