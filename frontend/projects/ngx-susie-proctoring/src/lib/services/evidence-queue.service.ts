import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { openDB, type IDBPDatabase } from 'idb';
import { NetworkMonitorService } from './network-monitor.service';
import { LoggerFn } from '@lib/models/contracts';

// ── Types ────────────────────────────────────────────────────────────────────

/** Represents a single queued evidence item persisted in IndexedDB. */
export interface QueuedEvidence {
    id?: number;
    /** Target endpoint URL (e.g. /monitoreo/evidencias/audios). */
    endpoint: string;
    method: 'POST';
    created_at: number;

    // — Multipart evidence (audio / snapshots) —
    meta_json?: string;
    payload_info_json?: string;
    blob?: Blob;

    // — JSON-only evidence (gaze tracking / infracciones) —
    body_json?: string;
    content_type?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = 'susie_evidence_queue';
const DB_VERSION = 2; // v2: added session_state store
const STORE_NAME = 'pending';
const SESSION_STATE_STORE = 'session_state'; // Compartido con SessionStorageService

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class EvidenceQueueService implements OnDestroy {
    private networkMonitor = inject(NetworkMonitorService);
    private db: IDBPDatabase | null = null;
    private flushing = false;
    private authToken = '';

    // Signal reactivo para el conteo de evidencias pendientes
    private _pendingCount = signal(0);
    readonly pendingCount = this._pendingCount.asReadonly();

    private logger: LoggerFn = () => { };

    /** Reactively flush queue when the browser comes back online. */
    private onlineEffect = effect(() => {
        const online = this.networkMonitor.isOnline();
        if (online && this.db) {
            this.flushQueue();
        }
    });

    // ── Public API ───────────────────────────────────────────────────────────

    setLogger(fn: LoggerFn) {
        this.logger = fn;
    }

    setAuthToken(token: string) {
        this.authToken = token;
    }

    /** Initialize the IndexedDB database. Call once during app bootstrap. */
    async init(): Promise<void> {
        if (this.db) return;

        try {
            this.db = await openDB(DB_NAME, DB_VERSION, {
                upgrade(db, oldVersion) {
                    // v1: Create pending store for evidence queue
                    if (oldVersion < 1) {
                        if (!db.objectStoreNames.contains(STORE_NAME)) {
                            db.createObjectStore(STORE_NAME, {
                                keyPath: 'id',
                                autoIncrement: true,
                            });
                        }
                    }
                    
                    // v2: Add session_state store for session recovery
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

            // Flush anything that was left over from a previous session
            await this.flushQueue();
        } catch (err) {
            this.logger('error', '❌ Error al inicializar IndexedDB para cola offline', err);
        }
    }

    /**
     * Enqueue a failed multipart evidence upload (audio / snapshot).
     * Stores the raw parts so we can rebuild the FormData later.
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

    /**
     * Enqueue a failed JSON-only upload (gaze tracking / infracciones).
     */
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

    /** Returns the count of items currently pending in the queue. */
    async getPendingCount(): Promise<number> {
        if (!this.db) return 0;
        return this.db.count(STORE_NAME);
    }

    /** Actualiza el signal de pending count con el valor actual de la cola. */
    private async updateCount(): Promise<void> {
        const count = await this.getPendingCount();
        this._pendingCount.set(count);
    }

    // ── Flush / Retry Logic ────────────────────────────────────────────────

    /** Process all pending items sequentially, retrying the original fetch. */
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
                // Stop flushing if we lose connectivity mid-process
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
                        // Non-retryable (4xx) — discard to avoid infinite loops
                        await this.db!.delete(STORE_NAME, item.id);
                        this.logger('error', `🗑️ Evidencia descartada (error no recuperable) → ${item.endpoint}`);
                        await this.updateCount();
                    }
                } catch {
                    // Network error during retry — stop and wait for next online event
                    this.logger('info', `⏸️ Reintento fallido — se intentará de nuevo al reconectar`);
                    break;
                }
            }
        } finally {
            this.flushing = false;
        }
    }

    /**
     * Retry a single queued item.
     * @returns true if the server accepted the request (2xx), false on 4xx (discard), throws on network error.
     */
    private async retryItem(item: QueuedEvidence): Promise<boolean> {
        const headers: Record<string, string> = {};
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        let body: BodyInit;

        if (item.body_json) {
            // JSON-only payload (gaze tracking, infracciones)
            headers['Content-Type'] = item.content_type || 'application/json';
            body = item.body_json;
        } else {
            // Multipart payload (audio / snapshots) — rebuild FormData
            const formData = new FormData();
            if (item.meta_json) formData.append('meta', item.meta_json);
            if (item.payload_info_json) formData.append('payload_info', item.payload_info_json);
            if (item.blob) {
                const isAudio = item.endpoint.includes('audios');
                const filename = isAudio ? 'audio.webm' : 'snapshot.jpg';
                formData.append('file', item.blob, filename);
            }
            body = formData;
        }

        const res = await fetch(item.endpoint, {
            method: item.method,
            headers,
            body,
            keepalive: true,
        });

        if (res.ok) return true;         // 2xx → success
        if (res.status >= 400 && res.status < 500) return false; // 4xx → discard
        throw new Error(`Server error ${res.status}`);           // 5xx → retry later
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────

    ngOnDestroy(): void {
        this.db?.close();
    }
}
