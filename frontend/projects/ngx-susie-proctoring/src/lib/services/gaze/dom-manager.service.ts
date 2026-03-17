import { Injectable, NgZone, inject } from '@angular/core';
import { GazeLoggerFn } from './gaze.interfaces';

const WEBGAZER_ELEMENTS = [
    'webgazerVideoContainer',
    'webgazerVideoFeed',
    'webgazerFaceOverlay',
    'webgazerGazeDot',
    'webgazerFaceFeedbackBox',
    'webgazerFaceAnnotations',
    'customGazeDot',
    'webgazer-core-styles',
    'webgazer-ghost-style',
    'webgazer-green-overlay',
] as const;

/**
 * Gestiona toda la manipulación del DOM relacionada con WebGazer:
 * - Inyección de estilos preventivos
 * - Silenciado de videos
 * - Overlay verde del face mesh
 * - Limpieza de elementos al detener
 */
@Injectable({ providedIn: 'root' })
export class DomManagerService {
    private ngZone = inject(NgZone);
    private logger: GazeLoggerFn = () => {};
    private muteObserver: MutationObserver | null = null;
    private muteRetryInterval: ReturnType<typeof setInterval> | null = null;

    configure(logger: GazeLoggerFn): void {
        this.logger = logger;
    }

    /**
     * Inyecta estilos globales preventivos para evitar el parpadeo de la cámara
     * cuando WebGazer inyecta sus elementos en el DOM.
     */
    injectStyles(): void {
        const styleId = 'webgazer-core-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #webgazerVideoContainer,
            #webgazerVideoFeed,
            #webgazerFaceOverlay,
            #webgazerFaceFeedbackBox,
            #webgazerFaceAnnotations {
                opacity: 0.001 !important;
                transition: opacity 0.3s ease !important;
                pointer-events: none !important;
                z-index: 9999 !important;
                visibility: visible !important;
                display: block !important;
            }
            #webgazerFaceOverlay, #webgazerFaceFeedbackBox {
                filter: hue-rotate(120deg) saturate(4) brightness(1.2) !important;
            }
            #webgazerGazeDot {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
        console.log('[GAZE-DOM] 🎨 Estilos preventivos inyectados (Ghost Mode)');
    }

    /**
     * Configura la cámara para modo calibración:
     * - Semi-transparente (15% opacity) para que el usuario vea su cara
     * - Detrás de los puntos de calibración (z-index bajo)
     * - Centrada y con bordes redondeados
     */
    configureVideoForCalibration(): void {
        const styleId = 'webgazer-calibration-style';
        document.getElementById(styleId)?.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #webgazerVideoContainer {
                opacity: 0.15 !important;
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                width: 320px !important;
                height: 240px !important;
                border-radius: 16px !important;
                overflow: hidden !important;
                z-index: 5 !important;
                pointer-events: none !important;
                border: 1px solid rgba(148, 163, 184, 0.1) !important;
                box-shadow: 0 0 40px rgba(0, 0, 0, 0.3) !important;
                bottom: auto !important;
                right: auto !important;
            }
            #webgazerVideoFeed {
                opacity: 1 !important;
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
            }
            #webgazerFaceOverlay {
                opacity: 0.6 !important;
                z-index: 6 !important;
            }
            #webgazerGazeDot {
                display: none !important;
            }
        `;
        document.head.appendChild(style);

        const videoFeed = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
        if (videoFeed?.paused) {
            videoFeed.play().catch(e => console.warn('[GAZE-DOM] Error al hacer play:', e));
        }

        console.log('[GAZE-DOM] 📷 Cámara configurada para calibración (semi-transparente, detrás de puntos)');
    }

    /**
     * Crea y muestra un punto rojo personalizado que sigue la mirada del usuario.
     * Se actualiza vía `updateGazeDot(x, y)` con coordenadas en píxeles.
     */
    showGazeDot(): void {
        let dot = document.getElementById('customGazeDot');
        if (!dot) {
            dot = document.createElement('div');
            dot.id = 'customGazeDot';
            Object.assign(dot.style, {
                position: 'fixed',
                zIndex: '100000',
                pointerEvents: 'none',
                width: '16px',
                height: '16px',
                background: 'rgba(255, 50, 50, 0.85)',
                border: '2px solid rgba(255, 255, 255, 0.9)',
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 12px rgba(255, 50, 50, 0.5), 0 0 4px rgba(0,0,0,0.3)',
                transition: 'left 0.05s linear, top 0.05s linear',
                display: 'block',
            });
            document.body.appendChild(dot);
        }
        dot.style.display = 'block';
        console.log('[GAZE-DOM] 🔴 Punto de gaze visible');
    }

    /**
     * Actualiza la posición del gaze dot.
     * @param x Coordenada X en píxeles.
     * @param y Coordenada Y en píxeles.
     */
    updateGazeDot(x: number, y: number): void {
        const dot = document.getElementById('customGazeDot');
        if (dot) {
            dot.style.left = `${x}px`;
            dot.style.top = `${y}px`;
        }
    }

    /** Oculta el gaze dot sin eliminarlo del DOM. */
    hideGazeDot(): void {
        const dot = document.getElementById('customGazeDot');
        if (dot) dot.style.display = 'none';
    }

    /**
     * Configura el video de WebGazer para el modo examen:
     * casi invisible (opacity 0.001) pero activo para que WebGazer procese frames.
     */
    configureVideoForExam(): void {
        // Remover estilos de calibración si existen
        document.getElementById('webgazer-calibration-style')?.remove();

        const wgContainer = document.getElementById('webgazerVideoContainer');
        const videoFeed = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;

        if (wgContainer) {
            wgContainer.style.opacity = '0.001';
            wgContainer.style.visibility = 'visible';
            wgContainer.style.display = 'block';
            wgContainer.style.position = 'fixed';
            wgContainer.style.zIndex = '9999';
            wgContainer.style.pointerEvents = 'none';
            wgContainer.style.width = '160px';
            wgContainer.style.height = '120px';
            wgContainer.style.bottom = '10px';
            wgContainer.style.right = '10px';
            wgContainer.style.top = 'auto';
            wgContainer.style.left = 'auto';
        }

        if (videoFeed) {
            videoFeed.style.opacity = '0.001';
            if (videoFeed.paused) {
                videoFeed.play().catch(e => console.warn('[GAZE-DOM] Error al hacer play:', e));
            }
        }
    }

    /**
     * Silencia TODOS los videos de WebGazer en el DOM.
     */
    muteAll(): void {
        const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
        if (videoEl) {
            videoEl.muted = true;
            videoEl.volume = 0;
            videoEl.setAttribute('muted', '');
        }

        ['webgazerVideoContainer', 'webgazerGazeDot'].forEach(id => {
            const container = document.getElementById(id);
            container?.querySelectorAll('video').forEach(v => {
                v.muted = true;
                v.volume = 0;
                v.setAttribute('muted', '');
            });
        });

        document.querySelectorAll('video').forEach(v => {
            if (!v.muted) {
                const isWebgazer = v.id === 'webgazerVideoFeed' ||
                    v.closest('#webgazerVideoContainer') !== null;
                if (isWebgazer) {
                    v.muted = true;
                    v.volume = 0;
                    v.setAttribute('muted', '');
                }
            }
        });
    }

    /**
     * Inicia un MutationObserver para silenciar agresivamente cualquier
     * <video> que WebGazer cree en el DOM, más un intervalo de respaldo.
     */
    startAggressiveMuting(): void {
        this.stopAggressiveMuting();

        this.muteObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node instanceof HTMLVideoElement) {
                        node.muted = true;
                        node.volume = 0;
                        node.setAttribute('muted', '');
                        this.logger('info', '🔇 Video de WebGazer silenciado automáticamente');
                    }
                    if (node instanceof HTMLElement) {
                        node.querySelectorAll('video').forEach(v => {
                            v.muted = true;
                            v.volume = 0;
                            v.setAttribute('muted', '');
                        });
                    }
                }
            }
        });

        this.muteObserver.observe(document.body, { childList: true, subtree: true });

        let retryCount = 0;
        this.muteRetryInterval = setInterval(() => {
            this.muteAll();
            retryCount++;
            if (retryCount >= 20) {
                clearInterval(this.muteRetryInterval!);
                this.muteRetryInterval = null;
            }
        }, 500);
    }

    /** Detiene el observer y el intervalo de muting. */
    stopAggressiveMuting(): void {
        if (this.muteObserver) {
            this.muteObserver.disconnect();
            this.muteObserver = null;
        }
        if (this.muteRetryInterval) {
            clearInterval(this.muteRetryInterval);
            this.muteRetryInterval = null;
        }
    }

    /**
     * Aplica color verde al face overlay de WebGazer (feedback visual durante calibración).
     */
    applyGreenFaceOverlay(): void {
        const apply = () => {
            const styleId = 'webgazer-green-overlay';
            if (document.getElementById(styleId)) return;

            const canvas = document.querySelector('#webgazerFaceOverlay');
            if (!canvas) return;

            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                #webgazerFaceOverlay, #webgazerFaceFeedbackBox,
                #webgazerFaceAnnotations, canvas[style*="face"] {
                    filter: drop-shadow(0 0 8px #00ff00) hue-rotate(120deg) saturate(4) brightness(1.2) !important;
                }
            `;
            document.head.appendChild(style);
        };

        apply();
        setTimeout(apply, 500);
        setTimeout(apply, 1000);
        setTimeout(apply, 2000);
    }

    /**
     * Elimina todos los elementos DOM relacionados con WebGazer y limpia observers.
     */
    cleanup(): void {
        WEBGAZER_ELEMENTS.forEach(id => {
            document.getElementById(id)?.remove();
        });
        document.getElementById('webgazer-calibration-style')?.remove();
        this.stopAggressiveMuting();
    }
}
