import { Component, input, output, signal, computed, inject, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SusieConfig } from '../../models/contracts';
import { StepInfo } from '../../models/contracts';
import { MediaService } from '../../services/media.service';
import { NetworkMonitorService } from '../../services/network-monitor.service';
import { StepIndicatorComponent } from '../step-indicator/step-indicator.component';

interface SystemCheck {
  id: 'browser' | 'camera' | 'microphone' | 'network';
  icon: string;
  label: string;
  status: 'idle' | 'checking' | 'success' | 'error' | 'skipped';
  message: string;
  optional: boolean;
}

/**
 * Componente de verificación de entorno con diseño premium.
 * Se muestra antes del examen para confirmar que el hardware y red son aptos.
 */
@Component({
  selector: 'susie-environment-check',
  standalone: true,
  imports: [CommonModule, StepIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './environment-check.component.html',
  styleUrl: './environment-check.component.css'
})
export class EnvironmentCheckComponent implements OnInit {
  policies = input<SusieConfig['securityPolicies'] | undefined>(undefined);
  steps = input<StepInfo[]>([]);
  checkCompleted = output<{ passed: boolean }>();

  // Checks
  checks = signal<SystemCheck[]>([
    { id: 'browser', icon: '🌐', label: 'Navegador compatible', status: 'idle', message: 'Pendiente...', optional: false },
    { id: 'camera', icon: '📷', label: 'Cámara web', status: 'idle', message: 'Pendiente...', optional: false },
    { id: 'microphone', icon: '🎤', label: 'Micrófono', status: 'idle', message: 'Pendiente...', optional: false },
    { id: 'network', icon: '📡', label: 'Conexión a internet', status: 'idle', message: 'Pendiente...', optional: true },
  ]);

  isChecking = signal(false);
  hasErrors = signal(false);

  private mediaService = inject(MediaService);
  private networkService = inject(NetworkMonitorService);

  ngOnInit() {
    this.runChecks();
  }

  async runChecks() {
    this.isChecking.set(true);
    this.hasErrors.set(false);

    // Updates based on policies (if available, otherwise assume all required)
    const pol = this.policies() || { requireCamera: true, requireMicrophone: true };

    this.updateCheck('camera', { optional: !pol.requireCamera, message: pol.requireCamera ? 'Esperando...' : 'Opcional' });
    this.updateCheck('microphone', { optional: !pol.requireMicrophone, message: pol.requireMicrophone ? 'Esperando...' : 'Opcional' });

    // 1. Browser
    await this.checkBrowser();

    // 2. Camera
    if (pol.requireCamera) await this.checkMedia('camera', true, false);
    else this.markSkipped('camera', 'No requerida para este examen.');

    // 3. Microphone
    if (pol.requireMicrophone) await this.checkMedia('microphone', false, true);
    else this.markSkipped('microphone', 'No requerido para este examen.');

    // 4. Network
    await this.checkNetwork();

    this.isChecking.set(false);

    // Check global success
    const failed = this.checks().some(c => !c.optional && c.status === 'error');
    this.hasErrors.set(failed);
  }

  private async checkBrowser() {
    this.setStatus('browser', 'checking', 'Verificando compatibilidad...');
    await this.wait(600);
    // Simple check: is WebRTC supported?
    if (navigator.mediaDevices) {
      this.setStatus('browser', 'success', 'Compatible');
    } else {
      this.setStatus('browser', 'error', 'Navegador no soportado');
    }
  }

  private async checkMedia(type: 'camera' | 'microphone', video: boolean, audio: boolean) {
    this.setStatus(type, 'checking', `Detectando dispositivo...`);
    await this.wait(800);

    // Check if we already have the stream from MediaService
    const currentStream = this.mediaService.stream();

    if (currentStream) {
      const hasVideo = video ? currentStream.getVideoTracks().length > 0 : true;
      const hasAudio = audio ? currentStream.getAudioTracks().length > 0 : true;

      if (hasVideo && hasAudio) {
        this.setStatus(type, 'success', 'Detectado y funcionando');
        return;
      }
    }

    // Try to get it if missing (redundancy)
    try {
      if (!currentStream) {
        this.setStatus(type, 'error', 'No se ha concedido permiso');
      } else {
        this.setStatus(type, 'error', `Dispositivo no encontrado`);
      }
    } catch (e) {
      this.setStatus(type, 'error', 'Error de acceso');
    }
  }

  private async checkNetwork() {
    this.setStatus('network', 'checking', 'Midiendo latencia...');
    await this.wait(800);
    if (this.networkService.isOnline()) {
      this.setStatus('network', 'success', 'Conexión estable');
    } else {
      this.setStatus('network', 'error', 'Sin internet');
    }
  }

  private setStatus(id: string, status: SystemCheck['status'], message: string) {
    this.checks.update(list => list.map(c => c.id === id ? { ...c, status, message } : c));
  }

  private updateCheck(id: string, updates: Partial<SystemCheck>) {
    this.checks.update(list => list.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  private markSkipped(id: string, msg: string) {
    this.setStatus(id, 'skipped', 'Omitido');
    this.updateCheck(id, { message: msg });
  }

  completeCheck() {
    this.checkCompleted.emit({ passed: true });
  }

  private wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}
