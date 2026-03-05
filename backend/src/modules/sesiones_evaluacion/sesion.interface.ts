//Estados válidos para la sesión.
export type EstadoSesion = 'EN_CURSO' | 'FINALIZADA' | 'INTERRUMPIDA';

//Recibe el id de la asigación para crear una nueva sesión de evaluación.
export interface CreateSesionEvaluacionDTO {
    id_asignacion:  bigint;
}