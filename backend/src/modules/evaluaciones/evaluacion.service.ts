import prisma from "../../config/prisma";
import { ConfiguracionExamenResponse } from "./evaluacion.interface";

export class EvaluacionService {
    
    async obtenerConfiguracionExamen(configuracion_id: bigint): Promise<ConfiguracionExamenResponse | null> {
        try {
            const configuracionRaw = await prisma.configuracion_examen.findUnique({
                where: {
                    configuracion_id: configuracion_id,
                },
            });

            if (!configuracionRaw) return null;//si no existe la configuracion, retorna null

            //Mapeo de datos
            const configuracionMapeada: ConfiguracionExamenResponse = {
                //configuracion_id: configuracionRaw.configuracion_id,
                analisis_mirada: configuracionRaw.analisis_mirada ?? false,
                camara: configuracionRaw.camara ?? false,
                max_cambio_pestana: configuracionRaw.max_cambio_pesta ?? 0,
                microfono: configuracionRaw.microfono ?? false,
                tiempo_sin_inactividad: configuracionRaw.tiempo_sin_inactividad ?? 0,
                tolerancia_desconexion: configuracionRaw.toleran_desconexion ?? 0,
                validacion_biometrica: configuracionRaw.validacion_biometrica ?? false,
            };

            return configuracionMapeada;

        } catch (error) {
            console.error('Error al obtener la configuración del examen:', error);
            throw error;
        }
    }
}