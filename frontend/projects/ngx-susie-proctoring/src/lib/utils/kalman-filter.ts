/**
 * Filtro de Kalman minimalista para suavizado predictivo unidimensional.
 *
 * Reduce el ruido de medición en señales ruidosas (ej: coordenadas de gaze)
 * combinando el estado estimado previo con la nueva medición, ponderados por
 * la incertidumbre del modelo (q) y del sensor (r).
 */
export class KalmanFilter {
    private x: number = 0;       // estado estimado
    private p: number = 1;       // error de estimación
    private initialized: boolean = false;

    /**
     * @param q Varianza del proceso (ruido del modelo). Valor mayor = confía más en mediciones nuevas.
     * @param r Varianza de la medición (ruido del sensor). Valor mayor = confía más en el modelo previo.
     * @param initialP Error de estimación inicial (default: 1).
     */
    constructor(
        private readonly q: number,
        private readonly r: number,
        private readonly initialP: number = 1
    ) {}

    /**
     * Actualiza el filtro con una nueva medición y devuelve el estado estimado.
     * @param measurement Nueva medición
     * @param confidence Confianza opcional de la medición (0-1). Si no se proporciona, usa R base.
     */
    update(measurement: number, confidence?: number): number {
        if (!this.initialized) {
            this.x = measurement;
            this.p = this.initialP;
            this.initialized = true;
            return this.x;
        }

        // Predicción
        this.p = this.p + this.q;

        // Calcular R efectivo basado en confianza
        // Fórmula: effectiveR = baseR * (1.5 - confidence)
        // - confidence alto (0.9): R menor → más peso a la medición
        // - confidence bajo (0.3): R mayor → más peso al modelo previo
        const effectiveR = confidence !== undefined
            ? this.r * (1.5 - confidence)
            : this.r;

        // Ganancia de Kalman
        const k = this.p / (this.p + effectiveR);

        // Actualización
        this.x = this.x + k * (measurement - this.x);
        this.p = (1 - k) * this.p;

        return this.x;
    }

    /**
     * Reinicia el filtro a su estado inicial (sin memoria histórica).
     * Útil después de interrupciones como pérdida de cara.
     */
    reset(): void {
        this.initialized = false;
        this.x = 0;
        this.p = 1;
    }
}
