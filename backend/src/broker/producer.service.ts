import { FastifyInstance } from 'fastify';

export class ProducerService {
  // Definimos el nombre del Exchange (debe coincidir con tu config)
  private readonly exchangeName = 'proctoring_events';

  constructor(private app: FastifyInstance) {}

  /**
   * Publica un mensaje en el Exchange principal para que RabbitMQ lo distribuya.
   * @param routingKey La etiqueta de ruta (ej: 'stream.snapshot' o 'stream.audio')
   * @param message Objeto JSON con los datos del sensor
   */
  async publish(routingKey: string, message: object): Promise<boolean> {
    const channel = this.app.amqp.channel;

    if (!channel) {
      this.app.log.error('Intentando publicar sin conexión a RabbitMQ');
      return false;
    }

    try {
      // Convertimos el objeto a Buffer (RabbitMQ solo entiende bytes)
      const buffer = Buffer.from(JSON.stringify(message));

      // Usamos .publish() en lugar de .sendToQueue()
      // Argumentos: Nombre del Exchange, Etiqueta (Routing Key), Contenido
      const sent = channel.publish(this.exchangeName, routingKey, buffer);
      
      if (sent) {
        this.app.log.info(`Mensaje publicado en [${this.exchangeName}] con etiqueta [${routingKey}]`);
      } else {
        this.app.log.warn('El buffer de escritura de RabbitMQ está lleno en este momento');
      }

      return sent;
      
    } catch (error) {
      this.app.log.error(error, 'Error al publicar mensaje en RabbitMQ');
      return false;
    }
  }
}