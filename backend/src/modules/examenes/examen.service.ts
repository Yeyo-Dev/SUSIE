import prisma from "../../config/prisma";
import { ExamenCompletoResponseDTO, PreguntaResponseDTO, PayloadRespuestasDTO } from "./examen.interface";

export class ExamenService {
    
    async obtenerExamenConPreguntas(examen_id: bigint): Promise<ExamenCompletoResponseDTO | null> {
        try {
            const idBigInt = BigInt(examen_id);

            const examenRaw = await prisma.examenes.findUnique({
                where: { examen_id: idBigInt },
                include: {
                    preguntas: true 
                }
            });

            if (!examenRaw) {//retorna null si no encuentra el examen
                return null;
            }
            //Mapeamos las preguntas para obtener solo los datos necesarios
            const preguntasFormateadas: PreguntaResponseDTO[] = examenRaw.preguntas.map((pregunta) => {       
                const opcionesBrutas = [
                    pregunta.opcion1,
                    pregunta.opcion2,
                    pregunta.opcion3,
                    pregunta.opcion4
                ];

                // Filtramos por si alguna pregunta es de "Verdadero/Falso" y solo tiene 2 opciones
                // Esto elimina los valores nulos o vacíos del arreglo final
                const opcionesLimpias = opcionesBrutas.filter(
                    (opcion): opcion is string => opcion !== null && opcion !== undefined && opcion.trim() !== ""
                );

                return {
                    pregunta_id: pregunta.pregunta_id, 
                    contenido: pregunta.contenido || "",
                    imagen: pregunta.imagen || null,
                    opciones: opcionesLimpias
                };
            });

            //Retornamos el examen con las preguntas formateadas
            return {
                detalles: {
                    examen_id: examenRaw.examen_id,
                    titulo: examenRaw.titulo || "Examen sin título",
                    descripcion: examenRaw.descripcion || "Sin descripción",
                    numero_de_preguntas: examenRaw.numero_de_preguntas || "0",
                    puntos_maximos: examenRaw.puntos_maximos || "0"
                },
                preguntas: preguntasFormateadas
            };

        } catch (error: any) {
            console.error("Error en ExamenService al obtener preguntas:", error);
            throw new Error("Fallo interno al consultar el examen en la base de datos.");
        }
    }

    async registrarRespuestas(payload: PayloadRespuestasDTO) {
        try {
            // se convierten los IDs generales a BigInt de forma segura
            const asignacionIdBigInt = BigInt(payload.asignacion_id);
            const examenIdBigInt = BigInt(payload.examen_id);
            const usuarioIdBigInt = BigInt(payload.usuario_id);

            // se prepara el arreglo de datos con la estructura exacta de la BD
            const datosAInsertar = payload.respuestas.map((item) => {
                return {
                    asignacion_id: asignacionIdBigInt,
                    examen_examen_id: examenIdBigInt,
                    usuario_id: usuarioIdBigInt,
                    pregunta_pregunta_id: BigInt(item.pregunta_id),
                    respuesta_dada: item.respuesta_usuario,
                    fecha_respuesta: new Date() // Le ponemos la fecha actual exacta
                };
            });

            // se hace una inserción masiva optimizada (1 sola consulta SQL)
            const resultado = await prisma.respuesta_usuario.createMany({
                data: datosAInsertar,
                skipDuplicates: true // Evita que el código explote si por error se manda la misma respuesta 2 veces
            });

            return {
                success: true,
                message: "Respuestas registradas exitosamente",
                registros_guardados: resultado.count
            };

        } catch (error: any) {
            console.error("Error en ExamenService al registrar respuestas:", error);
            // Validaciones de datos faltantes o llaves foráneas inválidas
            if (error.code === 'P2003') {
                throw new Error("BAD_REQUEST: Algunos IDs proporcionados (usuario, examen, asignación o pregunta) no existen en la base de datos.");
            }
            throw new Error("Fallo interno al registrar las respuestas en la base de datos.");
        }
    }
}