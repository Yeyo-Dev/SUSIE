export interface PreguntaResponseDTO {
    pregunta_id: bigint
    contenido: string;
    imagen: string | null;
    opciones: string[]; // Transformaremos opcion1, 2, 3 y 4 en un arreglo limpio
}

// Interfaz para los detalles generales del examen
export interface DetallesExamenDTO {
    examen_id: bigint;
    titulo: string;
    descripcion: string;
    numero_de_preguntas: string;
    puntos_maximos: string;
}

// La interfaz principal que agrupa todo lo que devolverá el endpoint
export interface ExamenCompletoResponseDTO {
    detalles: DetallesExamenDTO;
    preguntas: PreguntaResponseDTO[];
}