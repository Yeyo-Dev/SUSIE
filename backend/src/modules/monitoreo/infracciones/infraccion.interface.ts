
//interfaz para los datos de la infraccion
export interface CreateInfraccionDTO {
    id_sesion:           number | bigint
    minuto_infraccion:   string
    tipo_infraccion:     "CAMBIO_DE_PESTAÑA" | "USO_DE_TELEFONO" | "OTRO"
    detalles_infraccion: string
    url_azure_evidencia?: string | null
}