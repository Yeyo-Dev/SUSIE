import { FastifyInstance } from "fastify";
import { wsManager } from "../../../utils/ws.manager";

export async function infraccionWebsocketRoutes(fastify: FastifyInstance) {
    fastify.get('/:id_sesion', { websocket: true }, (connection, request) => {
        const { id_sesion } = request.params as { id_sesion: string };
        wsManager.addCliente(id_sesion, connection); 
        connection.send(JSON.stringify({ 
            tipo: 'CONECTADO_WS', 
            mensaje: `Conectado exitosamente al monitoreo de la sesión ${id_sesion}` 
        }));

        connection.on('message', (message) => {
            console.log('Mensaje recibido:', message.toString());
        });
    });
}

/*server.register(async function (fastify) {
    fastify.get(prefixApi + '/monitoreo/ws/:id_sesion', { websocket: true }, (connection, req) => {
        // Obtenemos el ID de la sesión desde la URL
        const { id_sesion } = req.params as { id_sesion: string };
        
        server.log.info(`🟢 Cliente conectado a la sesión: ${id_sesion}`);

        // Agregamos esta conexión a nuestro Directorio
        wsManager.addClient(id_sesion, connection.socket);
        
        // Mensaje de bienvenida opcional
        connection.socket.send(JSON.stringify({ 
            tipo: 'SISTEMA', 
            mensaje: `Conectado exitosamente al monitoreo de la sesión ${id_sesion}` 
        }));
    });
});*/