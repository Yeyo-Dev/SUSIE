import { FastifyRequest, FastifyReply } from 'fastify';
import { BiometricoService } from './biometrico.service';
import { BiometricsCreateDto } from './biometrico.interface';

export class BiometricoController {
    private biometricoService: BiometricoService;

    constructor() {
        this.biometricoService = new BiometricoService();
    }

    registroBiometricoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const parts = req.parts();
            let biometricData: BiometricsCreateDto | null = null;
            let resultadoProceso = null;

            for await (const part of parts) {
                if (part.type === 'field' && part.fieldname === 'meta') {
                    biometricData = JSON.parse(part.value as string);
                } else if (part.type === 'file') {
                    
                    if (!biometricData) {
                        return reply.code(400).send({
                            status: 'error',
                            message: 'Envíe el campo "meta" antes del archivo.'
                        });
                    }
                    // Procesamos el archivo enviándolo al servicio
                    resultadoProceso = await this.biometricoService.registrarBiometrico(
                        part,
                        biometricData
                    );
                    break;
                }
            }
            if (resultadoProceso) {
                return reply.code(201).send(resultadoProceso);
            } else {
                return reply.code(400).send({ message: 'No se recibió ninguna imagen biométrica.' });
            }

        } catch (error) {
            console.error("Error en controlador biométrico:", error);
            return reply.code(500).send({
                status: 'error',
                message: 'Ocurrió un error al procesar la solicitud biométrica.'
            });
        }
    }
}