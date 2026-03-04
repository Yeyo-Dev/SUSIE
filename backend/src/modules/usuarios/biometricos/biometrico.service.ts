import { MultipartFile } from '@fastify/multipart';
import { BiometricsCreateDto } from './biometrico.interface';
import prisma from '../../../config/prisma';

export class BiometricoService {

    async registroBiometricoExistente(usuarioId: number | bigint): Promise<boolean> {

        const registro = await prisma.biometricos_user.findUnique({
            where: { usuario_id: BigInt(usuarioId) },
            select: { 
                usuario_id: true 
            }
        });

        // Si se encontró un registro, significa que el usuario ya tiene datos biométricos registrados.
        return registro !== null;
    }

    async registrarBiometrico(file: MultipartFile, data: BiometricsCreateDto) {
        try {
            
            //Validamos que el usuario no tenga ya datos biométricos registrados
            const registroExistente = await this.registroBiometricoExistente(Number(data.usuario_id));
            if (registroExistente) {//Si ya tiene datos biométricos, lanzamos un error de conflicto para que el controlador lo maneje y devuelva un 409
                throw new Error("CONFLICT: El usuario ya cuenta con datos biométricos registrados");
            }
            // 2. Convertimos el archivo entrante en un Buffer de memoria
            // Esto evita tener que guardarlo en el disco duro solo para reenviarlo
            const fileBuffer = await file.toBuffer();

            // 3. COMUNICACIÓN CON EL SERVICIO EXTERNO (Simulación)
            /* // EJEMPLO DE CÓMO SE VERÍA LA LLAMADA REAL CON FETCH:
            const formData = new FormData();
            formData.append('file', new Blob([fileBuffer]), file.filename);
            
            const iaResponse = await fetch('http://localhost:5000/api/vectorize', {
                method: 'POST',
                body: formData
            });
            const iaResult = await iaResponse.json();
            const vectorObtenido = iaResult.embeddings;
            */
        
            const vectorSimulado = "[0.1234, -0.5678, 0.9101, 0.1121]"; 

            const nuevoRegistro = await prisma.biometricos_user.create({//Guardamos el resultado en la base de datos
                data: {
                    usuario_id: data.usuario_id,
                    vector_biometrico: vectorSimulado
                }
            });
            return {
                status: 'success',
                message: 'Biométrico registrado y vectorizado exitosamente',
                data: {
                    usuario_id: nuevoRegistro.usuario_id,
                    fecha_creacion: nuevoRegistro.fecha_creacion,
                    vector_status: 'generado_y_guardado'
                }
            };

        } catch (error:any) {
            //Si el error es CONFLICTO o BAD_REQUEST lo lanzamos tal cual para que el controlador pueda manejarlo
            if (error.message?.includes('CONFLICT') || error.message?.includes('BAD_REQUEST')) {
                throw error;
            }

            //Si el error es otro, lo consideramos un error interno del servidor
            console.error("Error en servicio biométrico:", error);
            throw new Error("Fallo al comunicarse con el servicio de IA o al guardar en base de datos");
        }
    }

    async actualizarBiometrico(file: MultipartFile, data: BiometricsCreateDto) {
        
        // Debe existir para poder actualizarse
        const existe = await this.registroBiometricoExistente(data.usuario_id);
        
        if (!existe) {
            // Lanzamos error tipo NOT_FOUND para que el controlador devuelva 404
            throw new Error('NOT_FOUND: El usuario no tiene biométricos registrados para actualizar. Use el registro primero.');
        }

        try {
            //Procesamiendo del nuevo archivo
            const fileBuffer = await file.toBuffer();

            // Llamada al servicio externo para obtener el nuevo vector 
            const vectorSimulado = "[0.9999, -0.8888, ...actualizado...]"; 

            // Actualizamos el registro existente con el nuevo vector
            const usuarioActualizado = await prisma.biometricos_user.update({
                where: { usuario_id: BigInt(data.usuario_id) },
                data: {
                    vector_biometrico: vectorSimulado,
                }
            });
            return {
                status: 'success',
                message: 'Datos biométricos actualizados correctamente',
                data: {
                    usuario_id: usuarioActualizado.usuario_id,
                    fecha_actualizacion: usuarioActualizado.fecha_actualizacion,
                    vector_status: 'actualizado'
                }
            };
        } catch (error: any) {
            console.error("Error en servicio de actualización:", error);
            // Reenviamos errores conocidos
            if (error.message?.includes('NOT_FOUND') || error.message?.includes('BAD_REQUEST')) {
                throw error;
            }
            throw new Error("Fallo interno al actualizar el biométrico.");
        }
    }

    async validarBiometrico(file: MultipartFile, data: BiometricsCreateDto) {
        try{
            // Verificamos que el usuario tenga datos biométricos registrados para validar
            const existe = await this.registroBiometricoExistente(data.usuario_id);

            if (!existe) {
                throw new Error('NOT_FOUND: El usuario no tiene biométricos registrados para validar.');
            }

            //Subimos la imagen a azure y obtenemos su URL
            const fileBuffer = await file.toBuffer();
            const urlSimulada = "https://azurestorage.com/biometricos/usuario123.jpg";

            //Obtenemos el vector del usuario desde la base de datos
            const registro = await prisma.biometricos_user.findUnique({
                where: { usuario_id: BigInt(data.usuario_id) },
                select: { vector_biometrico: true }
            });

            //Enviamos el vector almacenado y la URL de la nueva imagen al servicio de IA para validación
            const request = {
                imagen_url: urlSimulada,
                vector_db: registro?.vector_biometrico,
                umbral: 0.8 //Umbral de similitud
            };
            return {//Se retornará la respuesta del servivio de IA
                status: 'success',
                message: 'Validación biométrica completada',
                data: request
            };
        }catch(error:any){
            console.error("Error en servicio de validación:", error);
            // Reenviamos errores conocidos
            if (error.message?.includes('NOT_FOUND') || error.message?.includes('BAD_REQUEST')) {
                throw error;
            }
            throw new Error("Fallo al validar el biométrico. Verifique la comunicación con el servicio de IA o la integridad de los datos.");
        }
    }

    async eliminarBiometrico(usuarioId: number | bigint) {
        try {
            // Verificamos que el usuario tenga datos biométricos registrados para eliminar
            const existe = await this.registroBiometricoExistente(usuarioId);
            if (!existe) {
                throw new Error('NOT_FOUND: El usuario no tiene biométricos registrados para eliminar.');
            }

            await prisma.biometricos_user.delete({// Eliminamos el registro de la base de datos
                where: { usuario_id: BigInt(usuarioId) }
            });

            return {
                status: 'success',
                message: 'Datos biométricos eliminados correctamente',
            };
        }catch(error:any){
            if (error.message?.includes('NOT_FOUND')) {
                throw error;
            }
            console.error("Error en servicio de eliminación:", error);
            throw error;
        }
    }   
}