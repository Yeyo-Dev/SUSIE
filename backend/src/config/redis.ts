import fp from 'fastify-plugin';
import fastifyRedis, { FastifyRedisPluginOptions } from '@fastify/redis';
import { FastifyInstance } from 'fastify';

/**
 * Este plugin conecta a Redis y comparte la instancia
 * globalmente a través de 'app.redis'
 */
const redisPlugin = fp(async (fastify: FastifyInstance, opts: FastifyRedisPluginOptions) => {
  
  const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    family: 4, // IPv4
    ...opts // Permite sobreescribir opciones si se pasan desde el server.ts
  };

  // Registramos el plugin oficial
  await fastify.register(fastifyRedis, redisConfig);

  fastify.log.info(`Conectado a Redis en ${redisConfig.host}:${redisConfig.port}`);
  
});

export default redisPlugin;