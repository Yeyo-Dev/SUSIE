import fp from 'fastify-plugin';
import fastifyAmqp from 'fastify-amqp';
import { FastifyInstance } from 'fastify';

async function rabbitMQConnector(fastify: FastifyInstance) {
    //Optener la URL de RabbitMQ
    const url = process.env.RABBITMQ_URL;
    if (!url) {//sino existe la URL arroja error
        throw new Error('RABBITMQ_URL environment variable is undefined');
    }

    //Registramos la librería oficial
    await fastify.register(fastifyAmqp, {
        url: url, //url de rabbitmq
    });

    // Verificamos que conectó
    fastify.ready().then(() => {
        if (fastify.amqp.connection) {
            console.log('🐰 Conexión a RabbitMQ exitosa');
        }
    });
}

// Exportamos usando fastify-plugin para que sea global
export default fp(rabbitMQConnector);