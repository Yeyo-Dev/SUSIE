import prisma from "../../../config/prisma";
import { CreateInfraccionDTO } from "./infraccion.interface";

export class InfraccionService {
  
  async crearInfraccion(data: CreateInfraccionDTO) {
    try {
      const nuevaInfraccion = await prisma.infracciones_evaluacion.create({
        data: {
          // Nota: Si en Prisma 'id_sesion' es BigInt, asegúrate de no tener problemas de serialización al devolver el JSON.
          id_sesion: data.id_sesion, 
          minuto_infraccion: data.minuto_infraccion,
          tipo_infraccion: data.tipo_infraccion,
          detalles_infraccion: data.detalles_infraccion,
          url_azure_evidencia: data.url_azure_evidencia || null,
        },
      });
      
      return nuevaInfraccion;
      
    } catch (error) {
      console.error('Error en InfraccionService:', error);
      // Lanzamos el error para que el controlador lo atrape y responda con un 500
      throw new Error('No se pudo guardar la infracción en la base de datos'); 
    }
  }
}