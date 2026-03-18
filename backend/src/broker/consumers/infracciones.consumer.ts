// src/broker/consumers/infracciones.consumer.ts
import { FastifyInstance } from 'fastify';
import { ConsumerService } from '../consumer.service';
import { wsManager } from '../../utils/ws.manager';
// import { InfraccionService } from '../../modules/infracciones/infraccion.service';

export const setupInfraccionesConsumer = (server: FastifyInstance, consumer: ConsumerService) => {
    // const infraccionService = new InfraccionService();

    consumer.listen('q_infracciones', async (data) => {
        server.log.info('Nueva infraccion detectada (Consumer): ' + data);
        
        if(!("sesion_id" in data)){ //Verificamos que el mensaje tenga el id de la sesion
            server.log.warn('Se recibio una infraccion sin id_sesion. No se pudo notificar.');
            return;
        }
        console.log(data.sesion_id);
        const sesion_id = data.sesion_id;
        wsManager.enviarMensajeASesion(sesion_id, {
            tipo: 'ALERTA_INFRACCION',
            payload: data
        });
    });
};