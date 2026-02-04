import fastify from 'fastify';
import dotenv from 'dotenv';

dotenv.config();

const server = fastify({
    logger: true
});

server.get('/', async (request, reply) => {
    return { hello: 'world', service: 'SUSIE Backend' };
});

const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3000');
        await server.listen({ port, host: '0.0.0.0' });
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
