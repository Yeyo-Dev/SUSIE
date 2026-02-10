import { FastifyInstance } from 'fastify';

export class ProducerService {
  constructor(private app: FastifyInstance) {}
  /**
   * Envía un mensaje a una cola específica.
   * @param queue Nombre de la cola (ej: 'email_notifications')
   * @param message Objeto JSON con los datos
   */
  async publish(queue: string, message: object): Promise<boolean> {
    const channel = this.app.amqp.channel;

    if (!channel) {
      this.app.log.error('Intentando publicar sin conexión a RabbitMQ');
      return false;
    }

    try {
      //Aseguramos que la cola exista 
      //Durable = true para que no se borre si se reinicia Rabbit
      await channel.assertQueue(queue, { durable: true });

      //Convertimos el objeto a Buffer 
      //RabbitMQ solo entiende bytes
      const buffer = Buffer.from(JSON.stringify(message));

      //Enviamos el mensaje a la cola
      channel.sendToQueue(queue, buffer);
      
      this.app.log.info(`Mensaje enviado a cola [${queue}]`);
      return true;
      
    } catch (error) {
      this.app.log.error(error, 'Error al publicar mensaje en RabbitMQ');
      return false;
    }
  }
}