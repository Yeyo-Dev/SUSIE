import {FastifyInstance} from "fastify";
import * as UserController from "./user.controller";

export const userRoutes = async (fastify: FastifyInstance) => {
    fastify.post('/users/create', UserController.createUser);

    fastify.get('/test-redis', async (request, reply) => {
       const status = await fastify.redis.ping();
       return { redis: status };
    });
}