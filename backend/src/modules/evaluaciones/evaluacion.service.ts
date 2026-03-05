import prisma from "../../config/prisma";
import { EvaluacionConfigResponse, ConfiguracionExamenResponse, EvaluacionContext } from "./evaluacion.interface";

export class EvaluacionService {
    
    async obtenerConfiguracionExamen(evaluacion_id: bigint): Promise<EvaluacionConfigResponse | null> {
        try {
            //Busca la asignación
            const evaluacion = await prisma.asignacion_examen.findUnique({
                where: { id: evaluacion_id },
                include: {
                    usuario: true, // Traemos al candidato
                    examen: true   // Traemos los datos del examen
                }
            });

            // Si no existe la asignación o sus relaciones, retornamos null (404)
            if (!evaluacion || !evaluacion.usuario || !evaluacion.examen) {
                return null;
            }

            //Busca la configuración de supervisión
            const configRaw = await prisma.configuracion_examen.findFirst();

            //Mapea la configuración de supervisión
            const supervisionConfig: ConfiguracionExamenResponse = {
                //configuracion_id: configRaw?.configuracion_id ?? 0,
                analisis_mirada: configRaw?.analisis_mirada ?? false,
                camara: configRaw?.camara ?? false,
                max_cambio_pestana: configRaw?.max_cambio_pesta ?? 0,
                microfono: configRaw?.microfono ?? false,
                tiempo_sin_inactividad: configRaw?.tiempo_sin_inactividad ?? 0,
                tolerancia_desconexion: configRaw?.toleran_desconexion ?? 0,
                validacion_biometrica: configRaw?.validacion_biometrica ?? false,
            };

            //Mapea el contexto del examen
            const evaluacionContext: EvaluacionContext = {
                examen_id: evaluacion.examen.examen_id,
                examen_titulo: evaluacion.examen.titulo || "Examen sin título",
                duracion_minutos: 60, 
                asignacion_id: evaluacion.id,
                usuario_id: evaluacion.usuario.id,
                usuario_nombre: `${evaluacion.usuario.nombre || ''} ${evaluacion.usuario.apellidos || ''}`.trim(),
                usuario_email: evaluacion.usuario.email || null
            };

            //Retorna el objeto unificado respetando tu interfaz
            return {
                evaluacion: evaluacionContext,
                configuracion: supervisionConfig
            };

        } catch (error) {
            console.error('Error al obtener la configuración de la evaluación:', error);
            throw error;
        }
    }
}