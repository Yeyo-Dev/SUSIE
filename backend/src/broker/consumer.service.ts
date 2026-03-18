import { FastifyInstance } from 'fastify';

export class ConsumerService {

  constructor(private app: FastifyInstance) { }

  async listen(queueName: string, handler: (data: any) => Promise<void>) {
    const channel = this.app.amqp.channel;

    if (!channel) {
      this.app.log.error('No hay canal de RabbitMQ para consumir');
      return;
    }

    //Aseguramos que la cola exista
    await channel.assertQueue(queueName, { durable: true });
    // Le decimos a RabbitMQ que nos mande mensajes de 1 en 1 para no saturar Node.js
    await channel.prefetch(1);

    this.app.log.info(`Fastify escuchando resultados en la cola: [${queueName}]`);

    channel.consume(queueName, async (msg: any) => {
      if (msg !== null) {
        try {
          // Intentamos parsear el JSON
          const content = JSON.parse(msg.content.toString());

          await handler(content);
          channel.ack(msg); // Si todo sale bien, lo confirmamos

        } catch (error) {
          if (error instanceof SyntaxError) {
            this.app.log.error(`Mensaje ignorado en ${queueName}: No es un JSON valido.`);
            // Rechazamos el mensaje basura para que RabbitMQ lo borre y no se atasque
            channel.reject(msg, false);
          } else {
            this.app.log.error(error, `Error procesando mensaje de ${queueName}`);
            // Si fue un error de BD, tal vez sí queremos reencolarlo (true)
            // channel.reject(msg, true); 
          }
        }
      }
    });
  }
}