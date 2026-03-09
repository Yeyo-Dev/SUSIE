import { TestBed } from '@angular/core/testing';
import { EvidenceQueueService } from './evidence-queue.service';
import { NetworkMonitorService } from './network-monitor.service';
import { signal, WritableSignal } from '@angular/core';

/**
 * Helper: deletes the IndexedDB database used by the queue service
 * to guarantee a clean slate between tests.
 */
function deleteTestDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('susie_evidence_queue');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve(); // proceed even if blocked
    });
}

describe('EvidenceQueueService', () => {
    let service: EvidenceQueueService;
    let isOnlineSignal: WritableSignal<boolean>;

    beforeEach(async () => {
        await deleteTestDatabase();

        isOnlineSignal = signal(false); // start offline to prevent auto-flush

        TestBed.configureTestingModule({
            providers: [
                EvidenceQueueService,
                { provide: NetworkMonitorService, useValue: { isOnline: isOnlineSignal } },
            ],
        });

        service = TestBed.inject(EvidenceQueueService);
        service.setAuthToken('test-token-123');
    });

    afterEach(async () => {
        service.ngOnDestroy();
        await deleteTestDatabase();
    });

    // ══════════════════════════════════════════════════════════════
    // Scenario 1: Enqueue multipart evidence (audio / snapshot)
    // ══════════════════════════════════════════════════════════════

    describe('enqueueMultipart', () => {
        it('debe persistir una evidencia multipart (Blob + meta) en IndexedDB', async () => {
            await service.init();

            const blob = new Blob(['fake-audio-data'], { type: 'audio/webm' });
            await service.enqueueMultipart(
                'http://localhost:3000/monitoreo/evidencias/audios',
                { sesion_id: 42, usuario_id: 1, timestamp: Date.now() },
                { type: 'audio_segment', source: 'microphone' },
                blob
            );

            expect(await service.pendingCount()).toBe(1);
        });

        it('debe persistir múltiples items en IndexedDB', async () => {
            await service.init();

            const blob1 = new Blob(['audio-1'], { type: 'audio/webm' });
            const blob2 = new Blob(['audio-2'], { type: 'audio/webm' });

            await service.enqueueMultipart('http://api/audios', {}, {}, blob1);
            await service.enqueueMultipart('http://api/audios', {}, {}, blob2);

            expect(await service.pendingCount()).toBe(2);
        });

        it('no debe fallar si no hay Blob (evidencia sin archivo)', async () => {
            await service.init();

            await service.enqueueMultipart(
                'http://api/snapshots',
                { sesion_id: 1 },
                { type: 'snapshot_webcam', source: 'web' }
            );

            expect(await service.pendingCount()).toBe(1);
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Scenario 2: Enqueue JSON payload (gaze tracking)
    // ══════════════════════════════════════════════════════════════

    describe('enqueueJson', () => {
        it('debe persistir un payload JSON en IndexedDB', async () => {
            await service.init();

            await service.enqueueJson(
                'http://localhost:3000/monitoreo/evidencias/gaze_tracking',
                { sesion_id: 42, gaze_points: [{ x: 0.5, y: 0.3 }] }
            );

            expect(await service.pendingCount()).toBe(1);
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Scenario 3: Flush queue on reconnection (2xx success)
    // ══════════════════════════════════════════════════════════════

    describe('flushQueue (reconexión)', () => {
        it('debe reenviar y purgar items al reconectar con respuesta 2xx', async () => {
            await service.init();

            await service.enqueueJson('http://api/test', { data: 'offline-data' });
            expect(await service.pendingCount()).toBe(1);

            // Mock fetch para devolver 200 OK
            spyOn(globalThis, 'fetch').and.resolveTo(
                new Response(null, { status: 200 })
            );

            // Simular reconexión
            isOnlineSignal.set(true);
            TestBed.flushEffects();

            // Esperar a que el flush asíncrono procese
            await new Promise(r => setTimeout(r, 200));

            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            expect(await service.pendingCount()).toBe(0);
        });

        it('debe reconstruir FormData para items multipart al reintentar', async () => {
            await service.init();

            const blob = new Blob(['test-audio'], { type: 'audio/webm' });
            await service.enqueueMultipart(
                'http://api/audios',
                { sesion_id: 1 },
                { type: 'audio_segment' },
                blob
            );

            const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(
                new Response(null, { status: 200 })
            );

            isOnlineSignal.set(true);
            TestBed.flushEffects();
            await new Promise(r => setTimeout(r, 200));

            // Verificar que fetch fue llamado con FormData (no JSON)
            const callArgs = fetchSpy.calls.first();
            expect(callArgs.args[0]).toBe('http://api/audios');
            expect(callArgs.args[1]?.body instanceof FormData).toBe(true);
        });

        it('debe incluir Authorization header con Bearer token al reintentar', async () => {
            await service.init();

            await service.enqueueJson('http://api/test', { hello: 'world' });

            const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(
                new Response(null, { status: 200 })
            );

            isOnlineSignal.set(true);
            TestBed.flushEffects();
            await new Promise(r => setTimeout(r, 200));

            const headers = fetchSpy.calls.first().args[1]?.headers as Record<string, string>;
            expect(headers['Authorization']).toBe('Bearer test-token-123');
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Scenario 4: Discard on 4xx backend rejection
    // ══════════════════════════════════════════════════════════════

    describe('flushQueue (4xx → descarte)', () => {
        it('debe descartar items cuando el backend responde con 400', async () => {
            await service.init();

            await service.enqueueJson('http://api/test', { data: 'bad-request' });
            expect(await service.pendingCount()).toBe(1);

            spyOn(globalThis, 'fetch').and.resolveTo(
                new Response(null, { status: 400 })
            );

            isOnlineSignal.set(true);
            TestBed.flushEffects();
            await new Promise(r => setTimeout(r, 200));

            // Item debe haberse purgado — evitar reintento infinito
            expect(await service.pendingCount()).toBe(0);
        });

        it('debe descartar items cuando el backend responde con 404', async () => {
            await service.init();

            await service.enqueueJson('http://api/deleted-endpoint', { data: 'stale' });

            spyOn(globalThis, 'fetch').and.resolveTo(
                new Response(null, { status: 404 })
            );

            isOnlineSignal.set(true);
            TestBed.flushEffects();
            await new Promise(r => setTimeout(r, 200));

            expect(await service.pendingCount()).toBe(0);
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Scenario 5: Keep items on 5xx for retry later
    // ══════════════════════════════════════════════════════════════

    describe('flushQueue (5xx → mantener para reintento)', () => {
        it('debe mantener items en cola cuando el backend responde con 500', async () => {
            await service.init();

            await service.enqueueJson('http://api/test', { data: 'server-error' });
            expect(await service.pendingCount()).toBe(1);

            spyOn(globalThis, 'fetch').and.resolveTo(
                new Response(null, { status: 500 })
            );

            isOnlineSignal.set(true);
            TestBed.flushEffects();
            await new Promise(r => setTimeout(r, 200));

            // Item debe seguir en cola para reintento posterior
            expect(await service.pendingCount()).toBe(1);
        });
    });

    // ══════════════════════════════════════════════════════════════
    // Edge case: pendingCount on empty / uninitialized DB
    // ══════════════════════════════════════════════════════════════

    describe('pendingCount', () => {
        it('debe devolver 0 cuando la BD no está inicializada', async () => {
            // Sin llamar a init()
            expect(await service.pendingCount()).toBe(0);
        });

        it('debe devolver 0 cuando la cola está vacía', async () => {
            await service.init();
            expect(await service.pendingCount()).toBe(0);
        });
    });
});
