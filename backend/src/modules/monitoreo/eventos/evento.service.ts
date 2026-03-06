import prisma from "../../../config/prisma";
import { EventoDataContent } from "./evento.interface";

export class EventoService {

    async registrarEvento(eventoData: EventoDataContent) {
        //Validaciones de entrada
        if (!eventoData.id_sesion) throw new Error("BAD_REQUEST: El campo 'id_sesion' es requerido.");
        if (!eventoData.tipo_evento) throw new Error("BAD_REQUEST: El campo 'tipo_evento' es requerido.");
        if (eventoData.minuto_inicio === undefined || eventoData.minuto_inicio === null) {
            throw new Error("BAD_REQUEST: El campo 'minuto_inicio' es requerido.");
        }

        // Validamos que el evento sea de los permitidos para evitar inyección de datos
        const eventosPermitidos = [
            "CAMBIO_DE_PESTAÑA", 
            "PERDIDA_DE_FOCO", 
            "HERRAMIENTAS_DE_DESARROLLADOR", 
            "SALIDA_DE_PANTALLA_COMPLETA"
        ];
        
        //Validamos que el evento sea de los permitidos
        if (!eventosPermitidos.includes(eventoData.tipo_evento)) {
            throw new Error(`BAD_REQUEST: El tipo de evento '${eventoData.tipo_evento}' no es válido.`);
        }

        try {
            const idSesionBigInt = BigInt(eventoData.id_sesion);

            //Validamos que exista la sesion
            const sesionExiste = await prisma.sesion_evaluacion.findUnique({
                where: { id_sesion: idSesionBigInt }
            });

            if (!sesionExiste) {
                throw new Error("NOT_FOUND: La sesión de evaluación especificada no existe.");
            }

            //Registramos la infraccion
            const nuevaInfraccion = await prisma.infracciones_evaluacion.create({
                data: {
                    id_sesion: idSesionBigInt,
                    minuto_infraccion: eventoData.minuto_inicio,
                    tipo_infraccion: eventoData.tipo_evento,
                    // Dejamos un detalle por defecto para auditoría
                    detalles_infraccion: `Evento de monitoreo automático: ${eventoData.tipo_evento}`,
                }
            });

            // Retornamos los datos limpios (parseando el BigInt a string)
            return {
                success: true,
                message: "Evento registrado como infracción correctamente",
                data: {
                    id_infraccion: nuevaInfraccion.id_infraccion.toString(),
                    id_sesion: nuevaInfraccion.id_sesion.toString(),
                    tipo_infraccion: nuevaInfraccion.tipo_infraccion
                }
            };

        } catch (error: any) {
            console.error("Error en EventoService:", error);
            
            // Errores controlados
            if (error.message?.includes('BAD_REQUEST') || error.message?.includes('NOT_FOUND')) {
                throw error;
            }
            
            throw new Error("INTERNAL: Fallo al guardar la infracción en la base de datos.");
        }
    }
}