import { FastifyRequest, FastifyReply } from "fastify";
import { InfraccionService } from "./infraccion.service";
import { CreateInfraccionDTO } from "./infraccion.interface";

export class InfraccionController {
    private infraccionService: InfraccionService;

    constructor() {
        // Instanciamos el servicio
        this.infraccionService = new InfraccionService();
    }

    createHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            // Llamamos al método de la instancia
            const newInfraccion = await this.infraccionService.crearInfraccion(req.body as CreateInfraccionDTO);
            
            // Retornamos una respuesta estructurada
            return reply.code(201).send({
                status: 'success',
                message: 'Infracción registrada correctamente',
                data: newInfraccion
            });

        } catch (error) {//si existe 
            req.log.error(error);
            return reply.code(500).send({ 
                status: 'error',
                message: 'No se pudo registrar la infracción' 
            });
        }
    }
}