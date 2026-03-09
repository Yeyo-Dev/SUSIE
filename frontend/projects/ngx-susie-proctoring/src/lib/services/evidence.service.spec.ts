import { TestBed } from '@angular/core/testing';
import { EvidenceService } from './evidence.service';
import { EvidenceQueueService } from './evidence-queue.service';
import { NetworkMonitorService } from './network-monitor.service';
import { signal } from '@angular/core';

describe('EvidenceService (integración con cola offline)', () => {
    let service: EvidenceService;
    let queueService: jasmine.SpyObj<EvidenceQueueService>;

    beforeEach(() => {
        // Crear spy del EvidenceQueueService
        queueService = jasmine.createSpyObj('EvidenceQueueService', [
            'init', 'setLogger', 'setAuthToken',
            'enqueueMultipart', 'enqueueJson',
        ]);
        queueService.init.and.resolveTo();
        queueService.enqueueMultipart.and.resolveTo();
        queueService.enqueueJson.and.resolveTo();

        TestBed.configureTestingModule({
            providers: [
                EvidenceService,
                { provide: EvidenceQueueService, useValue: queueService },
                { provide: NetworkMonitorService, useValue: { isOnline: signal(true) } },
            ],
        });

        service = TestBed.inject(EvidenceService);

        // Configurar el servicio
        service.configure('http://localhost:3000', 'jwt-test-token', {
            userId: '1',
            userName: 'Test Student',
            examId: '100',
            examTitle: 'Examen de Prueba',
            assignmentId: 50,
        });
    });

    // ══════════════════════════════════════════════════════════════
    // configure() debe inicializar la cola
    // ══════════════════════════════════════════════════════════════

    describe('configure()', () => {
        it('debe inicializar el EvidenceQueueService', () => {
            expect(queueService.setAuthToken).toHaveBeenCalledWith('jwt-test-token');
            expect(queueService.init).toHaveBeenCalled();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Scenario: uploadEvidence enqueues audio on fetch failure
    // ══════════════════════════════════════════════════════════════

    describe('uploadEvidence → offline fallback', () => {
        it('debe encolar audio chunk cuando fetch falla por red', async () => {
            spyOn(globalThis, 'fetch').and.rejectWith(new TypeError('Failed to fetch'));

            const blob = new Blob(['audio-data'], { type: 'audio/webm' });
            service.sendEvent({
                type: 'AUDIO_CHUNK',
                browser_focus: true,
                file: blob,
            } as any);

            // Esperar a que la promesa interna se procese
            await new Promise(r => setTimeout(r, 100));

            expect(queueService.enqueueMultipart).toHaveBeenCalledWith(
                'http://localhost:3000/monitoreo/evidencias/audios',
                jasmine.objectContaining({ sesion_id: jasmine.any(Number) }),
                jasmine.objectContaining({ type: 'audio_segment' }),
                blob
            );
        });

        it('debe encolar snapshot cuando fetch falla por red', async () => {
            spyOn(globalThis, 'fetch').and.rejectWith(new TypeError('Failed to fetch'));

            const blob = new Blob(['snapshot-png'], { type: 'image/png' });
            service.sendEvent({
                type: 'SNAPSHOT',
                browser_focus: true,
                file: blob,
            } as any);

            await new Promise(r => setTimeout(r, 100));

            expect(queueService.enqueueMultipart).toHaveBeenCalledWith(
                'http://localhost:3000/monitoreo/evidencias/snapshots',
                jasmine.any(Object),
                jasmine.objectContaining({ type: 'snapshot_webcam' }),
                blob
            );
        });

        it('NO debe encolar cuando fetch tiene éxito', async () => {
            spyOn(globalThis, 'fetch').and.resolveTo(
                new Response(null, { status: 200 })
            );

            service.sendEvent({
                type: 'SNAPSHOT',
                browser_focus: true,
                file: new Blob(['ok']),
            } as any);

            await new Promise(r => setTimeout(r, 100));

            expect(queueService.enqueueMultipart).not.toHaveBeenCalled();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Scenario: sendGazeData enqueues on fetch failure
    // ══════════════════════════════════════════════════════════════

    describe('sendGazeData → offline fallback', () => {
        it('debe encolar gaze tracking cuando fetch falla', async () => {
            // Mock fetch: sesiones responde OK, todo lo demás falla
            spyOn(globalThis, 'fetch').and.callFake(async (input: any) => {
                if (typeof input === 'string' && input.includes('/sesiones')) {
                    return new Response(JSON.stringify({
                        id_sesion: '999',
                        id_asignacion: '50',
                        fecha_inicio: new Date().toISOString(),
                        fecha_fin: null,
                        estado_sesion: 'EN_CURSO',
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
                throw new TypeError('Failed to fetch');
            });

            await service.startSession();

            // Ahora enviar gaze data — fallará
            await service.sendGazeData([{ x: 0.5, y: 0.3 }, { x: 0.6, y: 0.4 }]);

            expect(queueService.enqueueJson).toHaveBeenCalledWith(
                'http://localhost:3000/monitoreo/evidencias/gaze_tracking',
                jasmine.objectContaining({
                    sesion_id: 999,
                    gaze_points: [{ x: 0.5, y: 0.3 }, { x: 0.6, y: 0.4 }],
                })
            );
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Scenario: sendInfraccion enqueues on fetch failure
    // ══════════════════════════════════════════════════════════════

    describe('sendInfraccion → offline fallback', () => {
        it('debe encolar infracción cuando fetch falla', async () => {
            // Crear sesión primero
            spyOn(globalThis, 'fetch').and.callFake(async (input: any) => {
                if (typeof input === 'string' && input.includes('/sesiones')) {
                    return new Response(JSON.stringify({
                        id_sesion: '888',
                        id_asignacion: '50',
                        fecha_inicio: new Date().toISOString(),
                        fecha_fin: null,
                        estado_sesion: 'EN_CURSO',
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
                throw new TypeError('Failed to fetch');
            });

            await service.startSession();

            // Enviar evento de tipo BROWSER_EVENT (se redirige a sendInfraccion)
            service.sendEvent({
                type: 'BROWSER_EVENT',
                browser_focus: false,
                trigger: 'TAB_SWITCH',
            } as any);

            await new Promise(r => setTimeout(r, 100));

            expect(queueService.enqueueJson).toHaveBeenCalledWith(
                'http://localhost:3000/monitoreo/infracciones',
                jasmine.objectContaining({
                    id_sesion: 888,
                    tipo_infraccion: 'CAMBIO_DE_PESTAÑA',
                })
            );
        });
    });
});
