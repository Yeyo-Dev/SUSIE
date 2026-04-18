import { FastifyInstance } from 'fastify';

/**
 * ConsumerService — Consume mensajes de q_infracciones en tiempo real.
 * 
 * Cuando un worker de IA detecta una infracción media/alta, la publica 
 * en q_infracciones. Este consumer:
 *   1. Guarda la infracción en Redis (para historial en tiempo real)
 *   2. Notifica al frontend vía WebSocket
 */
export class ConsumerService {
  private readonly queueName = 'q_infracciones';

  constructor(private app: FastifyInstance) {}

  /**
   * Inicia el consumo de q_infracciones.
   * Se llama una vez después de que RabbitMQ está conectado.
   */
  async iniciarConsumo(): Promise<void> {
    const channel = this.app.amqp?.channel;

    if (!channel) {
      this.app.log.warn('ConsumerService: No hay canal RabbitMQ disponible');
      return;
    }

    try {
      // Asegurar que la cola existe
      await channel.assertQueue(this.queueName, { durable: true });

      // Prefetch = 5 (infracciones son ligeras, podemos procesar varias)
      channel.prefetch(5);

      channel.consume(this.queueName, async (msg) => {
        if (!msg) return;

        try {
          const evento = JSON.parse(msg.content.toString());
          this.app.log.info(
            `[Consumer] Infracción recibida de [${evento.source}] — sesion=${evento.sesion_id}`
          );

          // 1. Guardar en Redis para que el motor de inferencia la lea después
          await this.guardarEnRedis(evento);

          // 2. Notificar al frontend vía WebSocket (si hay conexión activa)
          this.notificarWebSocket(evento);

          channel.ack(msg);
        } catch (error) {
          this.app.log.error(error, 'Error procesando infracción de q_infracciones');
          channel.nack(msg, false, false); // No reintentar
        }
      });

      this.app.log.info(`[Consumer] Escuchando en '${this.queueName}'`);
    } catch (error) {
      this.app.log.error(error, 'Error iniciando consumer de q_infracciones');
    }
  }

  /**
   * Guarda la infracción en Redis usando RPUSH (misma lista que los workers).
   * El motor de inferencia leerá toda la lista al cierre de sesión.
   */
  private async guardarEnRedis(evento: any): Promise<void> {
    try {
      const redis = this.app.redis;
      if (!redis) {
        this.app.log.warn('Redis no disponible para guardar infracción');
        return;
      }

      const key = `logs:${evento.sesion_id}:${evento.user_id}`;
      await redis.rpush(key, JSON.stringify(evento));
      // TTL de 24h, se renueva en cada inserción
      await redis.expire(key, 86400);
    } catch (error) {
      this.app.log.error(error, 'Error guardando infracción en Redis');
    }
  }

  /**
   * Envía la infracción al frontend vía WebSocket.
   * El frontend puede mostrar una alerta en tiempo real.
   */
  private notificarWebSocket(evento: any): void {
    // TODO: Implementar cuando el WebSocket del frontend esté listo.
    // Por ahora solo logueamos la intención.
    this.app.log.info(
      `[WS] Notificación pendiente para sesion=${evento.sesion_id}: ` +
      `source=${evento.source}, nivel infracción detectado`
    );
  }
}
