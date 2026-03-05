
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

export interface EvaluacionContext {
    examen_id: bigint;
    examen_titulo: string;
    duracion_minutos: number;
    asignacion_id: bigint;
    usuario_id: bigint;
    usuario_nombre: string;
    usuario_email: string | null;
}

// La interfaz principal que agrupa todo
export interface EvaluacionConfigResponse {
    evaluacion: EvaluacionContext;
    configuracion: ConfiguracionExamenResponse;
}