import { TestBed } from '@angular/core/testing';
import { GazeDeviationDetectionService } from '../gaze-deviation-detection.service';
import type { GazePoint } from '../gaze-smoothing.service';

describe('GazeDeviationDetectionService', () => {
    let service: GazeDeviationDetectionService;

    const createPoint = (x: number, y: number): GazePoint => ({
        x,
        y,
        ts: Date.now(),
    });

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [GazeDeviationDetectionService],
        });
        service = TestBed.inject(GazeDeviationDetectionService);
    });

    afterEach(() => {
        service.destroy();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('basic functionality', () => {
        it('should initialize with no deviation', () => {
            expect(service.hasDeviation()).toBe(false);
            expect(service.getDeviationStatus()).toBe(false);
            expect(service.getDeviationDuration()).toBe(0);
        });

        it('should start monitoring with provider', () => {
            service.setConfig(0.5, 1);
            service.start(() => createPoint(0.5, 0.5));
            expect(() => service.stop()).not.toThrow();
        });

        it('should handle null point provider', () => {
            service.setConfig(0.5, 1);
            service.start(() => null);
            expect(() => service.stop()).not.toThrow();
        });
    });

    describe('deviation detection logic', () => {
        it('should NOT detect deviation when point is within threshold', (done) => {
            service.setConfig(0.85, 1);
            service.start(() => createPoint(0.5, 0.5));

            setTimeout(() => {
                expect(service.getDeviationStatus()).toBe(false);
                service.destroy();
                done();
            }, 1500);
        });

        it('should detect deviation when point is outside threshold after tolerance', (done) => {
            service.setConfig(0.5, 1);
            service.start(() => createPoint(0.9, 0.9));

            setTimeout(() => {
                console.log('[TEST] hasDeviation:', service.getDeviationStatus());
                expect(service.getDeviationStatus()).toBe(true);
                service.destroy();
                done();
            }, 2500);
        });
    });
});
