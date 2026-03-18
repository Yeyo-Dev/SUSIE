// src/utils/ws.manager.ts
import type { WebSocket } from "@fastify/websocket";

export class WebSocketManager {
    // Usamos un Map donde la LLAVE es el id_sesion y el VALOR es un Set de conexiones.
    // Usamos un Set por si el reclutador tiene la misma sesión abierta en dos pestañas.
    private clientes_conectados: Map<string, Set<WebSocket>> = new Map();

    // Registrar un nuevo cliente
    addCliente(sesion_id: string, socket: WebSocket) {
        if (!this.clientes_conectados.has(sesion_id)) {//si no existe la sesion se crea
            this.clientes_conectados.set(sesion_id, new Set());
        }
        this.clientes_conectados.get(sesion_id)!.add(socket);

        // Cuando el cliente cierre la pestaña, lo borramos de la lista
        socket.on('close', () => {
            this.removeCliente(sesion_id, socket);
        });
    }

    // Eliminar un cliente desconectado
    removeCliente(sesion_id: string, socket: WebSocket) {
        const session_clientes = this.clientes_conectados.get(sesion_id);
        if (session_clientes) {
            session_clientes.delete(socket);
            // Si ya no hay nadie viendo esa sesión, borramos la llave para ahorrar memoria
            if (session_clientes.size === 0) {
                this.clientes_conectados.delete(sesion_id);
            }
        }
    }

    // Enviar mensaje solo a los de una sesion
    enviarMensajeASesion(sesion_id: string, message: object) {
        const session_clientes = this.clientes_conectados.get(sesion_id);

        if (session_clientes) {
            const messageString = JSON.stringify(message); // WebSockets solo envia texto

            for (const socket of session_clientes) {//Itera sobre todos los clientes conectados a la sesion
                if (socket.readyState === WebSocket.OPEN) {//Si el cliente esta conectado
                    socket.send(messageString);//Envía el mensaje
                }
            }
        }
        else {
            console.log(`No hay clientes conectados para la sesión: ${sesion_id}`);
        }
    }
}

// Exportamos una única instancia para usarla en todo el proyecto
export const wsManager = new WebSocketManager();