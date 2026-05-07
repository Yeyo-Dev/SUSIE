import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { openDB, type IDBPDatabase } from 'idb';
import { NetworkMonitorService } from './network-monitor.service';
import { LoggerFn } from '@lib/models/contracts';
import { firstValueFrom } from 'rxjs';

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Representa un elemento de evidencia encolado persistido en IndexedDB. */
export interface QueuedEvidence {
    id?: number;
    /** URL del endpoint destino (ej: /monitoreo/evidencias/audios). */
    endpoint: string;
    method: 'POST';
    created_at: number;

    // — Evidencia multipart (audio / snapshots) —
    meta_json?: string;
    payload_info_json?: string;
    blob?: Blob;

    // — Evidencia solo JSON (gaze tracking / infracciones) —
    body_json?: string;
    content_type?: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const DB_NAME = 'susie_evidence_queue';
const DB_VERSION = 2; // v2: agregado store de session_state
const STORE_NAME = 'pending';
const SESSION_STATE_STORE = 'session_state'; // Compartido con SessionStorageService

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class EvidenceQueueService implements OnDestroy {
    private networkMonitor = inject(NetworkMonitorService);
    private http = inject(HttpClient);
    private db: IDBPDatabase | null = null;
    private flushing = false;

    // Signal reactivo para el conteo de evidencias pendientes
    private _pendingCount = signal(0);
    readonly pendingCount = this._pendingCount.asReadonly();

    private logger: LoggerFn = () => { };

    /** Vacia la cola reactivamente cuando el navegador vuelve a estar online. */
    private onlineEffect = effect(() => {
        const online = this.networkMonitor.isOnline();
        if (online && this.db) {
            this.flushQueue();
        }
    });

    // ── API Pública ───────────────────────────────────────────────────────────

    setLogger(fn: LoggerFn) {
        this.logger = fn;
    }

    /** Inicializa la base de datos IndexedDB. Llamar una vez durante el bootstrap de la app. */
    async init(): Promise<void> {
        if (this.db) return;

        try {
            this.db = await openDB(DB_NAME, DB_VERSION, {
                upgrade(db, oldVersion) {
                    // v1: Crear store pending para cola de evidencias
                    if (oldVersion < 1) {
                        if (!db.objectStoreNames.contains(STORE_NAME)) {
                            db.createObjectStore(STORE_NAME, {
                                keyPath: 'id',
                                autoIncrement: true,
                            });
                        }
                    }
                    
                    // v2: Agregar store session_state para recuperación de sesión
                    if (oldVersion < 2) {
                        if (!db.objectStoreNames.contains(SESSION_STATE_STORE)) {
                            const sessionStore = db.createObjectStore(SESSION_STATE_STORE, {
                                keyPath: 'examSessionId',
                            });
                            sessionStore.createIndex('persistedAt', 'persistedAt');
                        }
                    }
                },
            });
            this.logger('success', '📦 IndexedDB inicializada para cola de evidencias offline');

            // Procesar cualquier evidencia pendiente de una sesión anterior
            await this.flushQueue();
        } catch (err) {
            this.logger('error', '❌ Error al inicializar IndexedDB para cola offline', err);
        }
    }

    /**
     * Encola una subida de evidencia multipart fallida (audio / snapshot).
     * Almacena las partes crudas para reconstruir el FormData después.
     */
    async enqueueMultipart(
        endpoint: string,
        meta: Record<string, any>,
        payloadInfo: Record<string, any>,
        blob?: Blob
    ): Promise<void> {
        if (!this.db) return;

        const item: QueuedEvidence = {
            endpoint,
            method: 'POST',
            created_at: Date.now(),
            meta_json: JSON.stringify(meta),
            payload_info_json: JSON.stringify(payloadInfo),
            blob: blob ?? undefined,
        };

        try {
            await this.db.add(STORE_NAME, item);
            this.logger('info', `📥 Evidencia encolada offline → ${endpoint} (${blob?.size ?? 0} bytes)`);
            await this.updateCount();
        } catch (err) {
            this.logger('error', '❌ Error al encolar evidencia en IndexedDB', err);
        }
    }

    /** Encola una subida fallida de solo JSON (gaze tracking / infracciones). */
    async enqueueJson(
        endpoint: string,
        body: Record<string, any>,
        contentType = 'application/json'
    ): Promise<void> {
        if (!this.db) return;

        const item: QueuedEvidence = {
            endpoint,
            method: 'POST',
            created_at: Date.now(),
            body_json: JSON.stringify(body),
            content_type: contentType,
        };

        try {
            await this.db.add(STORE_NAME, item);
            this.logger('info', `📥 Dato JSON encolado offline → ${endpoint}`);
            await this.updateCount();
        } catch (err) {
            this.logger('error', '❌ Error al encolar dato JSON en IndexedDB', err);
        }
    }

    /** Retorna la cantidad de elementos pendientes actualmente en la cola. */
    async getPendingCount(): Promise<number> {
        if (!this.db) return 0;
        return this.db.count(STORE_NAME);
    }

    /** Actualiza el signal de pending count con el valor actual de la cola. */
    private async updateCount(): Promise<void> {
        const count = await this.getPendingCount();
        this._pendingCount.set(count);
    }

    // ── Lógica de Flush / Reintento ────────────────────────────────────────────────

    /** Procesa todos los elementos pendientes secuencialmente, reintentando el fetch original. */
    private async flushQueue(): Promise<void> {
        if (!this.db || this.flushing) return;
        this.flushing = true;

        try {
            const items: QueuedEvidence[] = await this.db.getAll(STORE_NAME);
            if (items.length === 0) {
                this.flushing = false;
                return;
            }

            this.logger('info', `🔄 Procesando cola offline: ${items.length} item(s) pendientes`);

            for (const item of items) {
                // Detener el flush si perdemos conectividad durante el proceso
                if (!this.networkMonitor.isOnline()) {
                    this.logger('info', '⏸️ Red perdida durante flush — pausando cola');
                    break;
                }

                try {
                    const success = await this.retryItem(item);
                    if (success && item.id != null) {
                        await this.db!.delete(STORE_NAME, item.id);
                        this.logger('success', `✅ Evidencia offline reenviada → ${item.endpoint}`);
                        await this.updateCount();
                    } else if (!success && item.id != null) {
                        // No reintentable (4xx) — descartar para evitar bucles infinitos
                        await this.db!.delete(STORE_NAME, item.id);
                        this.logger('error', `🗑️ Evidencia descartada (error no recuperable) → ${item.endpoint}`);
                        await this.updateCount();
                    }
                } catch {
                    // Error de red durante reintento — detener y esperar próximo evento online
                    this.logger('info', `⏸️ Reintento fallido — se intentará de nuevo al reconectar`);
                    break;
                }
            }
        } finally {
            this.flushing = false;
        }
    }

    /**
     * Reintenta un único elemento encolado.
     * @returns true si el servidor aceptó el request (2xx), false en 4xx (descartar), lanza error en error de red.
     */
    private async retryItem(item: QueuedEvidence): Promise<boolean> {
        // Construir el body según el tipo de evidencia
        let body: unknown;
        let options: { headers?: Record<string, string> } = {};
        
        if (item.body_json) {
            // Payload solo JSON (gaze tracking, infracciones)
            body = JSON.parse(item.body_json);
            options = {
                headers: { 'Content-Type': item.content_type || 'application/json' }
            };
        } else {
            // Payload multipart (audio / snapshots) — reconstruir FormData
            const formData = new FormData();
            if (item.meta_json) formData.append('meta', item.meta_json);
            if (item.payload_info_json) formData.append('payload_info', item.payload_info_json);
            if (item.blob) {
                const isAudio = item.endpoint.includes('audios');
                const filename = isAudio ? 'audio.webm' : 'snapshot.jpg';
                formData.append('file', item.blob, filename);
            }
            body = formData;
            // NOTA: NO establecer Content-Type para FormData - HttpClient maneja el boundary
        }

        try {
            await firstValueFrom(
                this.http.post(item.endpoint, body, options).pipe(
                    // Re-lanzar errores de red para que flushQueue los maneje
                )
            );
            return true; // 2xx → éxito
        } catch (err: unknown) {
            // Determinar si es un error recuperable o no
            const httpError = err as { status?: number };
            if (httpError.status && httpError.status >= 400 && httpError.status < 500) {
                // 4xx → error de cliente, descartar
                return false;
            }
            // 5xx o error de red → reintentar después
            throw err;
        }
    }

    // ── Ciclo de Vida ────────────────────────────────────────────────────────────

    ngOnDestroy(): void {
        this.db?.close();
    }
}
