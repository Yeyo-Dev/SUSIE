
//interfaz para los datos de la infraccion
export interface CreateInfraccionDTO {
    id_sesion:           number | bigint
    minuto_infraccion:   string
    tipo_infraccion:     string
    detalles_infraccion: string
    url_azure_evidencia?: string | null
}