import { Injectable, OnDestroy, signal } from '@angular/core';
import { openDB, type IDBPDatabase } from 'idb';
import {
  PersistedSessionState,
  SESSION_STATE_VERSION,
  SESSION_STATE_STORE
} from '@lib/models/session-storage.interface';
import { LoggerFn } from '@lib/models/contracts';

// ── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = 'susie_evidence_queue';
const DB_VERSION = 2;
const DEBOUNCE_MS = 500;

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Servicio de persistencia de sesión que permite recuperar el estado
 * del examen después de un crash del navegador o cierre de pestaña.
 * 
 * Usa IndexedDB para almacenar el estado de forma persistente.
 * Comparte la base de datos con EvidenceQueueService (v2 schema).
 */
@Injectable({ providedIn: 'root' })
export class SessionStorageService implements OnDestroy {
  private db: IDBPDatabase | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private logger: LoggerFn = () => {};

  // ── Signals ──────────────────────────────────────────────────────────────

  /** Última vez que se guardó el estado (para UI feedback) */
  private _lastSaved = signal<Date | null>(null);
  readonly lastSaved = this._lastSaved.asReadonly();

  // ── Constructor & Lifecycle ──────────────────────────────────────────────

  constructor() {
    this.init();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Configura el logger para debug.
   */
  setLogger(fn: LoggerFn): void {
    this.logger = fn;
  }

  /**
   * Inicializa la conexión a IndexedDB. Idempotente.
   * Crea el object store session_state si no existe (v2 migration).
   */
  async init(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade: (db, oldVersion) => {
          // v1: pending store (lo maneja EvidenceQueueService)
          // v2: session_state store (NUEVO)
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
      this.logger('success', '📦 SessionStorage: IndexedDB inicializado');
    } catch (err) {
      this.logger('error', '❌ SessionStorage: Error al inicializar IndexedDB', err);
    }
  }

  /**
   * Verifica si existe una sesión persistida para el examen actual.
   */
  async hasSession(examSessionId: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      const state = await this.db.get(SESSION_STATE_STORE, examSessionId);
      return state != null;
    } catch {
      return false;
    }
  }

  /**
   * Carga el estado persistido desde IndexedDB.
   * Retorna null si no existe o siIndexedDB no está disponible.
   */
  async loadState(examSessionId: string): Promise<PersistedSessionState | null> {
    if (!this.db) return null;

    try {
      const state = await this.db.get(SESSION_STATE_STORE, examSessionId);
      if (state) {
        const answerCount = state.answers ? Object.keys(state.answers).length : 0;
        this.logger('info', `📂 SessionStorage: Estado cargado (${answerCount} respuestas)`);
      }
      return state ?? null;
    } catch (err) {
      this.logger('error', '❌ SessionStorage: Error al cargar estado', err);
      return null;
    }
  }

  /**
   * Persiste el estado con debounce para evitar escrituras excesivas.
   * Maneja QuotaExceededError graciosamente sin romper el flujo del examen.
   */
  async saveState(state: PersistedSessionState): Promise<void> {
    if (!this.db) return;

    // Debounce: cancelar save pendiente
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        const stateToSave: PersistedSessionState = {
          ...state,
          persistedAt: new Date().toISOString(),
          version: SESSION_STATE_VERSION,
        };

        await this.db!.put(SESSION_STATE_STORE, stateToSave);
        this._lastSaved.set(new Date());
        this.logger('info', `💾 SessionStorage: Estado persistido`);
      } catch (err) {
        // Manejar QuotaExceededError graciosamente
        if (err instanceof Error && err.name === 'QuotaExceededError') {
          this.logger('warn', '⚠️ SessionStorage: Cuota excedida, no se puede persistir');
        } else {
          this.logger('error', '❌ SessionStorage: Error al persistir', err);
        }
      }
    }, DEBOUNCE_MS);
  }

  /**
   * Limpia el estado persistido después de completar el examen.
   * Idempotente: no lanza error si no existe.
   */
  async clearState(examSessionId: string): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.delete(SESSION_STATE_STORE, examSessionId);
      this.logger('success', '🗑️ SessionStorage: Estado limpiado');
    } catch (err) {
      this.logger('error', '❌ SessionStorage: Error al limpiar estado', err);
    }
  }

  /**
   * Feature detection: verifica si IndexedDB está disponible.
   * Útil para detectar modo privado donde IndexedDB no funciona.
   */
  static isAvailable(): boolean {
    try {
      return 'indexedDB' in window && window.indexedDB !== null;
    } catch {
      return false;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.db?.close();
  }
}