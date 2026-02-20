import fp from 'fastify-plugin';
import fastifyAmqp from 'fastify-amqp';
import { FastifyInstance } from 'fastify';

async function rabbitMQConnection(fastify: FastifyInstance) {
  if (!process.env.RABBITMQ_URL) {
    throw new Error('RABBITMQ_URL no está definida en .env');
  }

  // Conexión al servidor RabbitMQ
  await fastify.register(fastifyAmqp, {
    url: process.env.RABBITMQ_URL,
  });

  // Configurar la Topología cuando Fastify esté listo
  fastify.ready().then(async () => {
    const channel = fastify.amqp.channel;
    const EXCHANGE_NAME = 'proctoring_events';

    if (!channel) return;

    try {
      fastify.log.info('Configurando colas en RabbitMQ...');

      //Crear el Exchange
      await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

      //Crear las 2 Colas
      await channel.assertQueue('q_snapshots', { durable: true });
      await channel.assertQueue('q_audios', { durable: true });

      //Crear las Reglas de Distribución (Bindings)
      // Todo mensaje con etiqueta 'stream.snapshot' irá a la cola de imágenes
      await channel.bindQueue('q_snapshots', EXCHANGE_NAME, 'stream.snapshot');
      
      // Todo mensaje con etiqueta 'stream.audio' irá a la cola de sonidos
      await channel.bindQueue('q_audios', EXCHANGE_NAME, 'stream.audio');

      fastify.log.info('RabbitMQ listo: Colas q_snapshots y q_audios configuradas.');

    } catch (error) {
      fastify.log.error(error, 'Error configurando RabbitMQ');
    }
  });
}

export default fp(rabbitMQConnection);//exportamos como plugin para usarlo en toda la aplicacion