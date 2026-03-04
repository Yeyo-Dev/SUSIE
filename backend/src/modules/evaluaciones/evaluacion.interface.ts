export interface ConfiguracionExamenResponse {
  //configuracion_id: bigint;
  analisis_mirada: boolean;
  camara: boolean;
  max_cambio_pestana: number;
  microfono: boolean;
  tiempo_sin_inactividad: number;
  tolerancia_desconexion: number;
  validacion_biometrica: boolean;
}