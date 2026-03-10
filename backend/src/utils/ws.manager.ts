// src/utils/ws.manager.ts
import { WebSocket } from 'ws';

export class WebSocketManager {
    // Usamos un Map donde la LLAVE es el id_sesion y el VALOR es un Set de conexiones.
    // Usamos un Set por si el reclutador tiene la misma sesión abierta en dos pestañas.
    private clients: Map<string, Set<WebSocket>> = new Map();

    // 1. Registrar un nuevo cliente
    addClient(sesion_id: string, socket: WebSocket) {
        if (!this.clients.has(sesion_id)) {
            this.clients.set(sesion_id, new Set());
        }
        this.clients.get(sesion_id)!.add(socket);

        // Cuando el cliente cierre la pestaña, lo borramos de la lista
        socket.on('close', () => {
            this.removeClient(sesion_id, socket);
        });
    }

    // 2. Eliminar un cliente desconectado
    removeClient(sesion_id: string, socket: WebSocket) {
        const sessionClients = this.clients.get(sesion_id);
        if (sessionClients) {
            sessionClients.delete(socket);
            // Si ya no hay nadie viendo esa sesión, borramos la llave para ahorrar memoria
            if (sessionClients.size === 0) {
                this.clients.delete(sesion_id);
            }
        }
    }

    // 3. Enviar mensaje SOLO a los de una sesión
    broadcastToSession(sesion_id: string, message: object) {
        const sessionClients = this.clients.get(sesion_id);
        
        if (sessionClients) {
            const messageString = JSON.stringify(message); // WebSockets solo envían texto
            
            for (const socket of sessionClients) {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(messageString);
                }
            }
        }
    }
}

// Exportamos una única instancia (Singleton) para usarla en todo el proyecto
export const wsManager = new WebSocketManager();