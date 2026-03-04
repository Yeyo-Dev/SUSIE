import { FastifyInstance } from "fastify";
import fastifyMultipart from "@fastify/multipart";
import { BiometricoController } from "./biometrico.controller";

export async function biometricoRoutes(fastify: FastifyInstance) {
    const controller = new BiometricoController();//Instanciamos el controlador
    
    fastify.register(fastifyMultipart, { //Registrar el plugin para manejar archivos
        limits: {
            fileSize: 10 * 1024 * 1024, // Límite de 10MB por archivo
        }
    });

    fastify.post('/', controller.registroBiometricoHandler);//Registrar biometricos
    fastify.put('/', controller.actualizarBiometricoHandler);//Actualizar biometricos
    fastify.post('/validar', controller.validarBiometricoHandler);//Validar biometricos
    fastify.delete('/:usuario_id', controller.eliminarBiometricoHandler);//Eliminar biometricos
}
