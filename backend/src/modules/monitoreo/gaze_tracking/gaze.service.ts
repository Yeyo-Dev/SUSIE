import { GazeData } from "./gaze.interface";
import { broker } from "../../../server"; 

export class GazeService {
    async procesarGazeData(data: GazeData) {
        
        //Validaciones de entrada
        if (!data.sesion_id) {
            throw new Error("BAD_REQUEST: El campo 'sesion_id' es obligatorio.");
        }       
        if (!data.timestamp) {
            throw new Error("BAD_REQUEST: El campo 'timestamp' es obligatorio.");
        }
        // Validamos que gaze_points exista, sea un arreglo y tenga al menos un punto
        if (!data.gaze_points || !Array.isArray(data.gaze_points) || data.gaze_points.length === 0) {
            throw new Error("BAD_REQUEST: Se requiere un arreglo válido y no vacío en 'gaze_points'.");
        }

        //Validar la estructura interna de los puntos que tengan 'x' e 'y' numéricos
        const puntosValidos = data.gaze_points.every(p => typeof p.x === 'number' && typeof p.y === 'number');
        if (!puntosValidos) {
            throw new Error("BAD_REQUEST: Todos los puntos de gaze_points deben contener 'x' e 'y' como números.");
        }

        try {
            //Preparación del payload
            const payload = {
                // Convertimos el ID a string por seguridad al serializar a JSON
                sesion_id: data.sesion_id.toString(), 
                timestamp: data.timestamp,
                gaze_points: data.gaze_points
            };

            const mensajeEncolado = await broker.publish('stream.gaze_tracking', payload);

            if (!mensajeEncolado) {
                console.error(`[RabbitMQ] Backpressure detectado al encolar gaze_tracking para sesión ${payload.sesion_id}`);
            }

            return {
                success: true,
                message: "Datos de tracking encolados correctamente"
            };

        } catch (error: any) {
            console.error("Error en GazeService al encolar datos:", error);
            
            if (error.message?.includes('INTERNAL')) throw error;
            
            throw new Error("Fallo interno al procesar los datos de Gaze Tracking.");
        }
    }
}