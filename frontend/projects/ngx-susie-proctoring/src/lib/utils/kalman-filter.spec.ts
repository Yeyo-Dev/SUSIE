import { KalmanFilter } from './kalman-filter';

describe('KalmanFilter', () => {
    describe('initialization', () => {
        it('should return the first measurement unchanged', () => {
            const filter = new KalmanFilter(0.1, 0.4);
            const result = filter.update(0.5);
            expect(result).toBe(0.5);
        });

        it('should initialize with different initial values', () => {
            const filter = new KalmanFilter(0.1, 0.4);
            expect(filter.update(-1)).toBe(-1);
        });
    });

    describe('filtering', () => {
        it('should smooth noisy measurements towards stable value', () => {
            const filter = new KalmanFilter(0.1, 0.4);
            filter.update(0); // initialize at 0

            // A sudden spike should be smoothed
            const result = filter.update(1);
            expect(result).toBeGreaterThan(0);
            expect(result).toBeLessThan(1);
        });

        it('should converge towards the true value over time', () => {
            const filter = new KalmanFilter(0.1, 0.4);
            filter.update(0); // init at 0

            // Feed stable measurements at 1.0 — filter should converge
            let lastResult = 0;
            for (let i = 0; i < 20; i++) {
                lastResult = filter.update(1.0);
            }

            expect(lastResult).toBeCloseTo(1.0, 1);
        });

        it('should give different results depending on q and r parameters', () => {
            // High r = trusts model more (slower filter)
            const slowFilter = new KalmanFilter(0.1, 10);
            // Low r = trusts measurements more (faster filter)
            const fastFilter = new KalmanFilter(0.1, 0.1);

            slowFilter.update(0);
            fastFilter.update(0);

            const slowResult = slowFilter.update(1);
            const fastResult = fastFilter.update(1);

            // Fast filter converges quicker → higher value after one step
            expect(fastResult).toBeGreaterThan(slowResult);
        });
    });

    describe('reset', () => {
        it('should re-initialize with next measurement after reset', () => {
            const filter = new KalmanFilter(0.1, 0.4);
            filter.update(0.5);
            filter.update(0.6);

            filter.reset();

            // After reset, first measurement should be returned as-is
            const result = filter.update(0.9);
            expect(result).toBe(0.9);
        });

        it('should allow re-use after reset with different values', () => {
            const filter = new KalmanFilter(0.1, 0.4);
            filter.update(100);
            filter.update(99);

            filter.reset();
            const result = filter.update(-1);
            expect(result).toBe(-1);
        });
    });

    // Task 5.1: Unit tests for KalmanFilter dynamicR
    describe('dynamicR (confidence parameter)', () => {
        // Using new params: Q=0.02, R=0.8
        const q = 0.02;
        const r = 0.8;
        const initialP = 0.1;

        it('should use baseR when confidence is undefined', () => {
            // Task 5.1, Test case 1: update() without confidence uses baseR
            const filter = new KalmanFilter(q, r, initialP);
            filter.update(100); // Initialize

            // With baseR=0.8 and confidence=undefined:
            // After init: p = initialP = 0.1
            // Prediction: p = p + q = 0.12
            // k = 0.12 / (0.12 + 0.8) = 0.12 / 0.92 ≈ 0.1304
            // x = 100 + 0.1304 * (110 - 100) ≈ 101.304
            const result = filter.update(110);
            expect(result).toBeCloseTo(101.3, 1);
        });

        it('should calculate effectiveR ≈ 0.48 when confidence=0.9', () => {
            // Task 5.1, Test case 2: update() with confidence=0.9 → effectiveR ≈ 0.48
            const filter = new KalmanFilter(q, r, initialP);
            filter.update(100); // Initialize

            // effectiveR = r * (1.5 - confidence) = 0.8 * (1.5 - 0.9) = 0.8 * 0.6 = 0.48
            // k = 0.12 / (0.12 + 0.48) = 0.12 / 0.6 = 0.2
            // x = 100 + 0.2 * (110 - 100) = 102
            const result = filter.update(110, 0.9);
            expect(result).toBeCloseTo(102, 0);
        });

        it('should calculate effectiveR ≈ 0.96 when confidence=0.3', () => {
            // Task 5.1, Test case 3: update() with confidence=0.3 → effectiveR ≈ 0.96
            const filter = new KalmanFilter(q, r, initialP);
            filter.update(100); // Initialize

            // effectiveR = r * (1.5 - confidence) = 0.8 * (1.5 - 0.3) = 0.8 * 1.2 = 0.96
            // k = 0.12 / (0.12 + 0.96) = 0.12 / 1.08 ≈ 0.111
            // x = 100 + 0.111 * (110 - 100) ≈ 101.11
            const result = filter.update(110, 0.3);
            expect(result).toBeCloseTo(101.1, 1);
        });

        it('should use minimum effectiveR when confidence=1.0', () => {
            // Task 5.1, Test case 4: update() with confidence=1.0 → effectiveR = 0.4 (minimum)
            const filter = new KalmanFilter(q, r, initialP);
            filter.update(100); // Initialize

            // effectiveR = r * (1.5 - confidence) = 0.8 * (1.5 - 1.0) = 0.8 * 0.5 = 0.4
            // k = 0.12 / (0.12 + 0.4) = 0.12 / 0.52 ≈ 0.231
            // x = 100 + 0.231 * (110 - 100) ≈ 102.31
            const result = filter.update(110, 1.0);
            expect(result).toBeCloseTo(102.3, 1);
        });

        it('should trust measurement more with higher confidence', () => {
            // Higher confidence should result in closer tracking of measurement
            const filterLowConf = new KalmanFilter(q, r, initialP);
            const filterHighConf = new KalmanFilter(q, r, initialP);

            filterLowConf.update(100);
            filterHighConf.update(100);

            const resultLowConf = filterLowConf.update(150, 0.3);
            const resultHighConf = filterHighConf.update(150, 0.9);

            // High confidence (0.9) should track measurement closer than low confidence (0.3)
            // High conf: effectiveR = 0.48 -> more weight to measurement
            // Low conf: effectiveR = 0.96 -> more weight to model
            expect(resultHighConf).toBeGreaterThan(resultLowConf);
        });

        it('should handle confidence=0 (maximum model trust)', () => {
            const filter = new KalmanFilter(q, r, initialP);
            filter.update(100); // Initialize

            // confidence=0: effectiveR = 0.8 * 1.5 = 1.2 (trusts model most)
            // k = 0.12 / (0.12 + 1.2) ≈ 0.091
            // x ≈ 100 + 0.091 * (110 - 100) ≈ 100.91
            const result = filter.update(110, 0);
            expect(result).toBeCloseTo(100.9, 1);
        });

it('should maintain state across multiple updates with varying confidence', () => {
            const filter = new KalmanFilter(q, r, initialP);

            filter.update(100);
            filter.update(105, 0.9);
            filter.update(110, 0.9);
            const result = filter.update(115, 0.9);

            // After multiple updates with high confidence, should track towards later values
            // With R=0.8 (high measurement noise), the filter converges slowly
            // The result will be around 105-108 range after only 4 measurements
            expect(result).toBeGreaterThan(103);
            expect(result).toBeLessThan(116);
        });
    });
});
