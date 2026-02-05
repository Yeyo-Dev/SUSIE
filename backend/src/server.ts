import Fastify from 'fastify';
import dotenv from 'dotenv';

dotenv.config();

const server = Fastify({
    logger : true
});

server.get('/', async(request, reply)=>{
    return {saludo:"Hola papu22"};
})

const start = async()=>{
    try {
        const port = parseInt(process.env.PORT || '8000');
        await server.listen({port, host:'0.0.0.0'});
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();