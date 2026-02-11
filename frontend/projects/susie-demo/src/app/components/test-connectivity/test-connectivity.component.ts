import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-test-connectivity',
  standalone: true,
  imports: [CommonModule, FileUploadModule, ToastModule, ButtonModule],
  providers: [MessageService],
  template: `
    <div class="upload-card">
      <h2 style="color: #333; margin-bottom: 2rem;">Prueba de Conectividad (Frontend -> Backend)</h2>
      
      <p-toast></p-toast>
      
      <div style="margin-bottom: 2rem; width: 100%; display: flex; justify-content: center;">
        <p-fileUpload 
            name="file" 
            url="http://localhost:8000/test-upload" 
            (onUpload)="onUpload($event)" 
            (onError)="onError($event)"
            accept="image/*,audio/*" 
            maxFileSize="5000000">
            <ng-template pTemplate="content">
                <ul *ngIf="uploadedFiles.length">
                    <li *ngFor="let file of uploadedFiles">{{ file.name }} - {{ file.size }} bytes</li>
                </ul>
            </ng-template>
        </p-fileUpload>
      </div>

      <div *ngIf="lastResponse" class="response-box">
        <h3>Respuesta del Backend:</h3>
        <pre>{{ lastResponse | json }}</pre>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .upload-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #fff;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      max-width: 800px;
      margin: 0 auto;
    }
    .response-box {
      background-color: #f8fafc;
      padding: 1rem;
      border-radius: 6px;
      width: 100%;
      border: 1px solid #e2e8f0;
      margin-top: 2rem;
      overflow-x: auto;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
      color: #0f172a;
      font-size: 0.9rem;
    }
    h2 {
        text-align: center;
    }
  `]
})
export class TestConnectivityComponent {
  uploadedFiles: any[] = [];
  lastResponse: any = null;

  constructor(private messageService: MessageService) { }

  onUpload(event: any) {
    if (event.originalEvent && event.originalEvent.body) {
      this.lastResponse = event.originalEvent.body;
    }

    for (let file of event.files) {
      this.uploadedFiles.push(file);
    }

    this.messageService.add({ severity: 'success', summary: 'Archivo subido', detail: 'El backend recibió el archivo correctamente' });
  }

  onError(event: any) {
    this.messageService.add({ severity: 'error', summary: 'Error de subida', detail: 'No se pudo contactar al backend' });
    console.error('Upload error:', event);
  }
}
