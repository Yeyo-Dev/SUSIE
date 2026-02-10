import { FastifyRequest, FastifyReply } from "fastify";
import { broker } from "../../server";

export const registerUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as { email: string, password: string };
    
    const message = {
        email,
        password
    };

    if(broker){
        await broker.publish('test_queues', message);
    }else{
        reply.log.error('Broker no disponible');
        return reply.status(500).send({ message: 'Error interno del servidor' });
    }
    
    return reply.status(202).send({ message: 'Usuario registrado' });
}