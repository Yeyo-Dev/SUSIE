import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SusieWrapperComponent, SusieConfig } from 'ngx-susie-proctoring';
import { ButtonModule } from 'primeng/button';
import { TestConnectivityComponent } from './components/test-connectivity/test-connectivity.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, SusieWrapperComponent, ButtonModule, TestConnectivityComponent],
    template: `
    <!-- Wrapper de SUSIE protegiendo el contenido del examen -->
    <susie-wrapper [config]="examConfig">
        
        <!-- CONTENIDO SIMULADO DEL EXAMEN (Lo que inyecta la App Cliente) -->
        <div class="exam-container">
            <header>
                <h1>Examen de Certificación - Demo</h1>
                <p>Tiempo restante: 45:00</p>
            </header>
            
            <main>
                <div class="question-card">
                    <h3>Pregunta 1 de 10</h3>
                    <p>¿Cuál es el principal beneficio de usar Standalone Components en Angular?</p>
                    
                    <div class="options">
                        <label><input type="radio" name="q1"> Reducción de Boilerplate (No NgModules)</label>
                        <label><input type="radio" name="q1"> Mayor velocidad de ejecución</label>
                        <label><input type="radio" name="q1"> Compatibilidad con AngularJS</label>
                    </div>
                </div>

                <div class="actions">
                    <button class="btn-prev">Anterior</button>
                    <button class="btn-next">Siguiente</button>
                </div>

                <hr class="my-5">
                
                <!-- Componente de Prueba de Conectividad -->
                 <app-test-connectivity></app-test-connectivity>

            </main>
        </div>

    </susie-wrapper>
  `,
    styles: [`
    .exam-container {
        max-width: 800px;
        margin: 40px auto;
        background: white;
        padding: 40px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        border-radius: 8px;
    }
    
    header {
        border-bottom: 2px solid #eee;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .question-card {
        margin-bottom: 30px;
    }

    .options label {
        display: block;
        padding: 10px;
        background: #f9f9f9;
        margin-bottom: 8px;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .options label:hover {
        background: #eef;
    }
  `]
})
export class AppComponent {
    // Configuración enviada a la librería
    examConfig: SusieConfig = {
        sessionContext: {
            examSessionId: 'sess_' + Math.floor(Math.random() * 10000),
            examId: 'cert_angular_v17',
            durationMinutes: 60
        },
        securityPolicies: {
            requireCamera: false,         // ✅ Habilitado para pruebas
            requireMicrophone: true,     // ✅ Habilitado para pruebas de audio
            requireFullscreen: true,
            preventTabSwitch: true,
            preventInspection: true
        },
        audioConfig: {
            enabled: true,
            chunkIntervalSeconds: 10,    // Chunks cada 10 segundos
            bitrate: 32000               // 32 kbps
        },
        debugMode: true,  // ✅ Habilitar panel de debug para pruebas
        apiUrl: 'http://localhost:8000/api/v1',  // ✅ Puerto 8000 (backend)
        authToken: 'demo-jwt-token-xyz'
    };
}
