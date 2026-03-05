import prisma from "../../../config/prisma";
import { MetadataEvento, EventoPayloadInfo } from "./evento.interface";
import { InfraccionService } from "../infracciones/infraccion.service";//Para registrar infracciones desde eventos

export class EventoService {

    async registrarEvento(metadata: MetadataEvento, payloadInfo: EventoPayloadInfo) {

    }
}