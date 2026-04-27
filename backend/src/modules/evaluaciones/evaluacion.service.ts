import prisma from "../../config/prisma";
import { EvaluacionConfigResponse, ConfiguracionExamenResponse, EvaluacionContext } from "./evaluacion.interface";

export class EvaluacionService {
    async obtenerConfiguracionExamen(evaluacion_id: bigint): Promise<EvaluacionConfigResponse | null> {
        try {
            // Busca la asignación con todas sus relaciones en una sola consulta
            const evaluacion = await prisma.asignacion_examen.findUnique({
                where: { id: evaluacion_id },
                include: {
                    usuario: true, // Traemos al candidato
                    examen: true,  // Traemos los datos del examen
                    configuracion_examen: true // Traemos la configuración asociada
                }
            });

            // Si no existe la asignación o sus relaciones principales, retornamos null (404)
            if (!evaluacion || !evaluacion.usuario || !evaluacion.examen) {
                return null;
            }

            // Extraemos la configuración. 
            // Como Prisma lo devuelve como un arreglo (configuracion_examen[]), tomamos la primera [0]
            const configRaw = evaluacion.configuracion_examen && evaluacion.configuracion_examen.length > 0 
                ? evaluacion.configuracion_examen[0] 
                : null;

            // Mapea la configuración de supervisión
            const supervisionConfig: ConfiguracionExamenResponse = {
                analisis_mirada: configRaw?.analisis_mirada ?? false,
                camara: configRaw?.camara ?? false,
                max_cambio_pestana: configRaw?.max_cambio_pesta ?? 0,
                microfono: configRaw?.microfono ?? false,
                tiempo_sin_inactividad: configRaw?.tiempo_sin_inactividad ?? 0,
                tolerancia_desconexion: configRaw?.toleran_desconexion ?? 0,
                validacion_biometrica: configRaw?.validacion_biometrica ?? false,
            };

            // Mapea el contexto del examen
            const evaluacionContext: EvaluacionContext = {
                examen_id: evaluacion.examen.examen_id,
                examen_titulo: evaluacion.examen.titulo || "Examen sin título",
                duracion_minutos: configRaw?.tiempo_duracion || 0, 
                asignacion_id: evaluacion.id,
                usuario_id: evaluacion.usuario.id,
                usuario_nombre: `${evaluacion.usuario.nombre || ''} ${evaluacion.usuario.apellidos || ''}`.trim(),
                usuario_email: evaluacion.usuario.email || null
            };

            // Retorna el objeto unificado respetando tu interfaz
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