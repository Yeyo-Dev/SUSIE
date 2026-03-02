import { CreateSesionEvaluacionDTO} from "./sesion.interface";
import prisma from "../../config/prisma";

export class SesionEvaluacionService{
    //Crea una nueva sesión de evaluación en la base de datos.
    async crearSesionEvaluacion(data: CreateSesionEvaluacionDTO) {
        try {
            const nuevaSesionEvaluacion = await prisma.sesion_evaluacion.create({
                data: {
                    id_asignacion: data.id_asignacion,
                    fecha_inicio: new Date(), // Fecha de inicio al momento de crear la sesión
                    estado_sesion: 'EN_CURSO', // Estado inicial de la sesión
                },
            });
            return nuevaSesionEvaluacion;
        } catch (error) {
            console.error('Error en SesionEvaluacionService:', error);
            // Lanzamos el error para que el controlador lo atrape y responda con un 500
            throw new Error('No se pudo guardar la sesion de evaluacion en la base de datos'); 
        }
    }

    // Finaliza una sesión de evaluación actualizando su estado a 'FINALIZADA' y estableciendo la fecha de fin.
    async finalizarSesionEvaluacion(id_sesion: bigint) {
        try {
            const sesionActualizada = await prisma.sesion_evaluacion.update({
                where: { id_sesion },
                data: {
                    estado_sesion: 'FINALIZADA',
                    fecha_fin: new Date(),
                },
            });
            return sesionActualizada;
        } catch (error) {
            console.error('Error al finalizar la sesión de evaluación:', error);
            throw new Error('No se pudo finalizar la sesión de evaluación en la base de datos');
        }
    }
}