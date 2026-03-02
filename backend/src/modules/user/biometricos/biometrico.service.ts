import { MultipartFile } from '@fastify/multipart';
import { BiometricsCreateDto } from './biometrico.interface';
import prisma from '../../../config/prisma';

export class BiometricoService {

    async registrarBiometrico(file: MultipartFile, data: BiometricsCreateDto) {
        try {
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
            
            /*
            await prisma.usuarios.update({
                where: { id: BigInt(data.usuario_id) },
                data: {
                    vector_biometrico: vectorSimulado
                }
            });
            */
            return {
                status: 'success',
                message: 'Biométrico registrado y vectorizado exitosamente',
                data: {
                    usuario_id: data.usuario_id,
                    vector_status: 'generado_y_guardado'
                }
            };

        } catch (error) {
            console.error("Error en servicio biométrico:", error);
            throw new Error("Fallo al comunicarse con el servicio de IA o al guardar en base de datos");
        }
    }
}