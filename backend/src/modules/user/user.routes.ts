import {FastifyInstance} from "fastify";
import * as UserController from "./user.controller";

export const userRoutes = async (fastify: FastifyInstance) => {
    fastify.post('/users/create', UserController.registerUser);
}