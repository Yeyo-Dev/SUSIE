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

        } catch (error: any) {
            console.error("Error en controlador biométrico:", error);
            //Manejo de biometricos ya registrados para el usuario
            if (error.message?.includes('CONFLICT')) {
                return reply.code(409).send({ 
                    status: 'error', 
                    message: 'El usuario ya cuenta con datos biométricos registrados.' 
                });
            }
            return reply.code(500).send({
                status: 'error',
                message: 'Ocurrió un error al procesar la solicitud biométrica.'
            });
        }
    }

    actualizarBiometricoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const parts = req.parts();
            let biometricData: BiometricsCreateDto | null = null;
            let resultadoProceso = null;

            for await (const part of parts) {//Iteramos sobre las partes del multipart para encontrar el campo "meta" y el archivo
                if (part.type === 'field' && part.fieldname === 'meta') {
                    biometricData = JSON.parse(part.value as string);
                } else if (part.type === 'file') {
                    if (!biometricData) {
                        return reply.code(400).send({
                            status: 'error',
                            message: 'Envíe el campo "meta" antes del archivo.'
                        });
                    }
                    // LLAMADA AL SERVICIO DE ACTUALIZACIÓN
                    resultadoProceso = await this.biometricoService.actualizarBiometrico(
                        part,
                        biometricData
                    );
                    break;
                }
            }
            if (!resultadoProceso) {// Si no se procesó ningún archivo, respondemos con error
                return reply.code(400).send({ message: 'No se recibió ninguna imagen para actualizar.' });
            }
            return reply.code(200).send(resultadoProceso);

        } catch (error: any) {
            console.error("Error en controlador de actualización:", error);
            
            //Manejo para usuario sin biometricos registrados
            if (error.message?.includes('NOT_FOUND')) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: error.message 
                });
            }
            //Manejo de BAD_REQUEST para casos como formato de imagen no soportado
            if (error.message?.includes('BAD_REQUEST')) {
                return reply.code(400).send({ status: 'error', message: error.message });
            }
            return reply.code(500).send({
                status: 'error',
                message: 'Error interno al actualizar los datos biométricos.'
            });
        }
    }

    validarBiometricoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const parts = req.parts();
            let biometricData: BiometricsCreateDto | null = null;
            let resultadoValidacion = null;

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

                    //Servicio de validación biométrica
                    resultadoValidacion = await this.biometricoService.validarBiometrico(
                        part,
                        biometricData
                    );
                    break;
                }
            }

            if (!resultadoValidacion) {// Si no se procesó ningún archivo, respondemos con error
                return reply.code(400).send({ message: 'No se recibió ninguna imagen para validar.' });
            }

            //Verificamos el resultado de la validación para determinar el código de respuesta
           /* if (resultadoValidacion.status === 'success') {
                return reply.code(200).send(resultadoValidacion); // 200 OK si la validación es exitosa
            } else {
                return reply.code(401).send({ // 401 Unauthorized si la validación falla
                    status: 'error',
                    message: 'La validación biométrica ha fallado. No coincide con los datos registrados.'
                });
            }*/
            //Simulacion de respuesta
            return reply.code(200).send(resultadoValidacion);

        } catch (error: any) {
            console.error("Error en controlador de validación:", error);

            //  Manejo de usuario sin biometricos registrados
            if (error.message?.includes('NOT_FOUND')) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: error.message 
                });
            }

            //Manejo de BAD_REQUEST para casos como formato de imagen no soportado
            if (error.message?.includes('BAD_REQUEST')) {
                return reply.code(400).send({ status: 'error', message: error.message });
            }

            //Error genérico para otros casos
            return reply.code(500).send({
                status: 'error',
                message: 'Error interno al validar los datos biométricos.'
            });
        }
    }

    eliminarBiometricoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const { usuario_id } = req.params as { usuario_id: bigint };
            //Servicio de eliminación de datos biométricos
            const resultadoEliminacion = await this.biometricoService.eliminarBiometrico(BigInt(usuario_id));

            if (resultadoEliminacion) {
                return reply.code(200).send({
                    status: 'success',
                    message: 'Datos biométricos eliminados correctamente.'
                });
            }
        } catch (error: any) {
            console.error("Error en controlador de eliminación:", error);

            // Manejo de NOT FOUND (Usuario no existe) -> 404
            if (error.message?.includes('NOT_FOUND')) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: error.message 
                });
            }

            //Error genérico para otros casos
            return reply.code(500).send({
                status: 'error',
                message: 'Error interno al eliminar los datos biométricos.'
            });
        }
    }
}