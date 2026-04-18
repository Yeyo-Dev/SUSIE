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
      fastify.log.info('Configurando topología RabbitMQ...');

      // ── Exchange principal (topic) ─────────────────────────
      await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

      // ── Colas de entrada a Workers IA ──────────────────────
      await channel.assertQueue('q_snapshots', { durable: true });
      await channel.assertQueue('q_audios', { durable: true });
      await channel.assertQueue('q_gaze', { durable: true });

      // ── Colas de salida de Workers IA ──────────────────────
      // q_infracciones: resultados en tiempo real (workers → backend → WebSocket)
      await channel.assertQueue('q_infracciones', { durable: true });

      // ── Cola para el Motor de Inferencia ───────────────────
      // q_evidencia: batch al cierre de sesión (backend → inference engine)
      await channel.assertQueue('q_evidencia', { durable: true });

      // ── Bindings: routing keys → colas ─────────────────────
      await channel.bindQueue('q_snapshots', EXCHANGE_NAME, 'stream.snapshot');
      await channel.bindQueue('q_audios', EXCHANGE_NAME, 'stream.audio');
      await channel.bindQueue('q_gaze', EXCHANGE_NAME, 'stream.gaze');

      fastify.log.info(
        'RabbitMQ listo: Colas configuradas — ' +
        'q_snapshots, q_audios, q_gaze, q_infracciones, q_evidencia'
      );

    } catch (error) {
      fastify.log.error(error, 'Error configurando RabbitMQ');
    }
  });
}

export default fp(rabbitMQConnection);