import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Component, signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { SusieWrapperComponent } from './susie-wrapper.component';
import { ProctoringOrchestratorService, ProctoringState } from '@lib/services/proctoring-orchestrator.service';
import { EvidenceQueueService } from '@lib/services/evidence-queue.service';
import { SessionStorageService } from '@lib/services/session-storage.service';
import { PersistedSessionState } from '@lib/models/session-storage.interface';

// ── Stubs de sub-componentes (evitar renderizado profundo) ──
@Component({ selector: 'susie-consent-dialog', standalone: true, template: '' })
class StubConsentDialog { }
@Component({ selector: 'susie-biometric-onboarding', standalone: true, template: '' })
class StubBiometricOnboarding { }
@Component({ selector: 'susie-environment-check', standalone: true, template: '' })
class StubEnvironmentCheck { }
@Component({ selector: 'susie-exam-engine', standalone: true, template: '' })
class StubExamEngine { }
@Component({ selector: 'susie-gaze-calibration', standalone: true, template: '' })
class StubGazeCalibration { }
@Component({ selector: 'susie-exam-briefing', standalone: true, template: '' })
class StubExamBriefing { }
@Component({ selector: 'susie-step-indicator', standalone: true, template: '' })
class StubStepIndicator { }
@Component({ selector: 'susie-camera-pip', standalone: true, template: '' })
class StubCameraPip { }
@Component({ selector: 'susie-permission-prep', standalone: true, template: '' })
class StubPermissionPrep { }

// ── Helpers ──
function buildConfig(overrides: any = {}): any {
    return {
        sessionContext: {
            examSessionId: 'sess-1',
            examId: 'ex-1',
            examTitle: 'Test Exam',
            durationMinutes: 30,
        },
        securityPolicies: {
            requireCamera: false,
            requireMicrophone: false,
            requireFullscreen: true,
            requireConsent: true,
            requireBiometrics: false,
            preventTabSwitch: true,
            requireGazeTracking: false,
            requireEnvironmentCheck: false,
        },
        apiUrl: 'http://localhost',
        authToken: 'tok',
        debugMode: false,
        ...overrides,
    };
}

// ── Mock del Orchestrator ──
function createMockOrchestrator(): any {
    const stateSignal = signal<ProctoringState>('CHECKING_PERMISSIONS');
    
    return {
        state: stateSignal,
        stateChange: {
            emit: jasmine.createSpy('emit'),
            subscribe: jasmine.createSpy('subscribe').and.callFake((fn: Function) => {
                return { unsubscribe: () => {} };
            }),
        },
        stepsWithStatus: signal([]),
        mediaStream: signal(null),
        mediaError: signal(null),
        isOnline: signal(true),
        aiAlert: signal(null),
        inactivityWarning: signal(false),
        tabSwitchCount: signal(0),
        remainingTabSwitches: signal(undefined),
        needsFullscreenReturn: signal(false),
        needsFocusReturn: signal(false),
        biometricValidating: signal(false),
        biometricError: signal(null),
        biometricSuccess: signal(false),
        logs: signal([]),
        
        // Methods
        initialize: jasmine.createSpy('initialize'),
        initializeFlow: jasmine.createSpy('initializeFlow').and.resolveTo(),
        handlePermissionPrepared: jasmine.createSpy('handlePermissionPrepared'),
        handleConsent: jasmine.createSpy('handleConsent'),
        handleBiometricCompleted: jasmine.createSpy('handleBiometricCompleted').and.resolveTo(),
        handleBiometricSuccessConfirmed: jasmine.createSpy('handleBiometricSuccessConfirmed'),
        handleBiometricRetake: jasmine.createSpy('handleBiometricRetake'),
        handleEnvironmentCheck: jasmine.createSpy('handleEnvironmentCheck'),
        handleGazeCalibrationCompleted: jasmine.createSpy('handleGazeCalibrationCompleted'),
        handleBriefingAcknowledged: jasmine.createSpy('handleBriefingAcknowledged'),
        handleExamFinished: jasmine.createSpy('handleExamFinished'),
        returnToFullscreen: jasmine.createSpy('returnToFullscreen').and.resolveTo(),
        returnToFocus: jasmine.createSpy('returnToFocus'),
        retryMedia: jasmine.createSpy('retryMedia'),
        confirmActivity: jasmine.createSpy('confirmActivity'),
        dismissCriticalAlert: jasmine.createSpy('dismissCriticalAlert'),
        clearLogs: jasmine.createSpy('clearLogs'),
        destroy: jasmine.createSpy('destroy'),
        
        // Getters for services
        getMediaService: () => ({ stop: jasmine.createSpy('stop'), getAudioStream: () => null }),
        getEvidenceService: () => ({ 
            stopAudioRecording: jasmine.createSpy('stopAudioRecording'),
            endSession: jasmine.createSpy('endSession'),
            startSession: jasmine.createSpy('startSession').and.resolveTo('session-123')
        }),
        getGazeService: () => ({ stop: jasmine.createSpy('stop'), isCalibrated: () => false }),
    };
}

// ── Mock del EvidenceQueueService ──
const mockPendingCountSignal = signal(0);
function createMockEvidenceQueueService(): any {
    return {
        pendingCount: mockPendingCountSignal.asReadonly(),
    };
}

// ── Mock del SessionStorageService ──
function createMockSessionStorageService(): jasmine.SpyObj<SessionStorageService> {
    return jasmine.createSpyObj<SessionStorageService>('SessionStorageService', [
        'init',
        'hasSession',
        'loadState',
        'saveState',
        'clearState',
        'setLogger',
    ], {
        lastSaved: signal(null),
    });
}

// ── Helper: Create test persisted state ──
function createTestPersistedState(overrides: Partial<PersistedSessionState> = {}): PersistedSessionState {
    return {
        examSessionId: 'sess-1',
        examId: 'ex-1',
        answers: { 1: 'A', 2: 'B', 3: 'C' },
        currentQuestionIndex: 2,
        timerSecondsRemaining: 1800,
        examStartedAt: new Date(Date.now() - 600000).toISOString(), // 10min ago
        proctoringState: 'MONITORING',
        totalViolations: 0,
        tabSwitchCount: 0,
        remoteSessionId: 'remote-123',
        persistedAt: new Date().toISOString(),
        version: 1,
        ...overrides,
    };
}

describe('SusieWrapperComponent', () => {
    let component: SusieWrapperComponent;
    let fixture: ComponentFixture<SusieWrapperComponent>;
    let mockOrchestrator: any;
    let mockSessionStorage: jasmine.SpyObj<SessionStorageService>;

    beforeEach(async () => {
        mockOrchestrator = createMockOrchestrator();
        mockSessionStorage = createMockSessionStorageService();

        await TestBed.configureTestingModule({
            imports: [SusieWrapperComponent],
        })
            .overrideComponent(SusieWrapperComponent, {
                set: {
                    imports: [
                        StubConsentDialog,
                        StubBiometricOnboarding,
                        StubEnvironmentCheck,
                        StubExamEngine,
                        StubGazeCalibration,
                        StubExamBriefing,
                        StubStepIndicator,
                        StubCameraPip,
                        StubPermissionPrep,
                    ],
                    schemas: [NO_ERRORS_SCHEMA],
                    providers: [
                        { provide: ProctoringOrchestratorService, useValue: mockOrchestrator },
                        { provide: EvidenceQueueService, useValue: createMockEvidenceQueueService() },
                        { provide: SessionStorageService, useValue: mockSessionStorage },
                    ],
                },
            })
            .compileComponents();

        fixture = TestBed.createComponent(SusieWrapperComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        try { component.ngOnDestroy(); } catch (_) { /* ignore */ }
    });

    // ═══════════════════════════════════════════════════
    // Creación del componente
    // ═══════════════════════════════════════════════════

    it('debe crear el componente', () => {
        fixture.componentRef.setInput('config', buildConfig());
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    // ═══════════════════════════════════════════════════
    // Inicialización
    // ═══════════════════════════════════════════════════

    describe('Inicialización', () => {
        it('debe inicializar el orchestrator con la config', async () => {
            const cfg = buildConfig();
            fixture.componentRef.setInput('config', cfg);
            fixture.detectChanges();
            await fixture.whenStable();

            expect(mockOrchestrator.initialize).toHaveBeenCalledWith(cfg, jasmine.any(Object));
        });

        it('debe llamar initializeFlow al iniciar', async () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            await fixture.whenStable();

            expect(mockOrchestrator.initializeFlow).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════
    // Delegation a métodos del orchestrator
    // ═══════════════════════════════════════════════════

    describe('Delegación de métodos', () => {
        beforeEach(async () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
        });

        it('handlePermissionPrepared debe delegar al orchestrator', () => {
            component.handlePermissionPrepared();
            expect(mockOrchestrator.handlePermissionPrepared).toHaveBeenCalled();
        });

        it('handleConsent debe delegar al orchestrator', () => {
            component.handleConsent({ accepted: true, timestamp: '', permissionsConsented: [] });
            expect(mockOrchestrator.handleConsent).toHaveBeenCalled();
        });

        it('handleBiometricCompleted debe delegar al orchestrator', async () => {
            await component.handleBiometricCompleted({ photo: new Blob() });
            expect(mockOrchestrator.handleBiometricCompleted).toHaveBeenCalled();
        });

        it('handleBiometricSuccessConfirmed debe delegar al orchestrator', () => {
            component.handleBiometricSuccessConfirmed();
            expect(mockOrchestrator.handleBiometricSuccessConfirmed).toHaveBeenCalled();
        });

        it('handleBiometricRetake debe delegar al orchestrator', () => {
            component.handleBiometricRetake();
            expect(mockOrchestrator.handleBiometricRetake).toHaveBeenCalled();
        });

        it('handleEnvironmentCheck debe delegar al orchestrator', () => {
            component.handleEnvironmentCheck({ passed: true });
            expect(mockOrchestrator.handleEnvironmentCheck).toHaveBeenCalled();
        });

        it('handleGazeCalibrationCompleted debe delegar al orchestrator', () => {
            component.handleGazeCalibrationCompleted();
            expect(mockOrchestrator.handleGazeCalibrationCompleted).toHaveBeenCalled();
        });

        it('handleBriefingAcknowledged debe delegar al orchestrator', () => {
            component.handleBriefingAcknowledged();
            expect(mockOrchestrator.handleBriefingAcknowledged).toHaveBeenCalled();
        });

        it('handleExamFinished debe delegar al orchestrator', () => {
            component.handleExamFinished({ answers: {}, completedAt: '' });
            expect(mockOrchestrator.handleExamFinished).toHaveBeenCalled();
        });

        it('returnToFullscreen debe delegar al orchestrator', async () => {
            await component.returnToFullscreen();
            expect(mockOrchestrator.returnToFullscreen).toHaveBeenCalled();
        });

        it('returnToFocus debe delegar al orchestrator', () => {
            component.returnToFocus();
            expect(mockOrchestrator.returnToFocus).toHaveBeenCalled();
        });

        it('retryMedia debe delegar al orchestrator', () => {
            component.retryMedia();
            expect(mockOrchestrator.retryMedia).toHaveBeenCalled();
        });

        it('confirmActivity debe delegar al orchestrator', () => {
            component.confirmActivity();
            expect(mockOrchestrator.confirmActivity).toHaveBeenCalled();
        });

        it('dismissCriticalAlert debe delegar al orchestrator', () => {
            component.dismissCriticalAlert();
            expect(mockOrchestrator.dismissCriticalAlert).toHaveBeenCalled();
        });

        it('clearLogs debe delegar al orchestrator', () => {
            component.clearLogs();
            expect(mockOrchestrator.clearLogs).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════
    // Exposición de signals del orchestrator
    // ═══════════════════════════════════════════════════

    describe('Exposición de signals', () => {
        it('debe exponer state del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            // El componente debe exponer el signal del orchestrator
            expect(component.state).toBe(mockOrchestrator.state);
        });

        it('debe exponer stepsWithStatus del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            expect(component.stepsWithStatus).toBe(mockOrchestrator.stepsWithStatus);
        });

        it('debe exponer mediaStream del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            expect(component.mediaStream).toBe(mockOrchestrator.mediaStream);
        });

        it('debe exponer tabSwitchCount del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            expect(component.tabSwitchCount).toBe(mockOrchestrator.tabSwitchCount);
        });

        it('debe exponer needsFullscreenReturn del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            expect(component.needsFullscreenReturn).toBe(mockOrchestrator.needsFullscreenReturn);
        });

        it('debe exponer needsFocusReturn del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            expect(component.needsFocusReturn).toBe(mockOrchestrator.needsFocusReturn);
        });

        it('debe exponer biometricValidating del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            expect(component.biometricValidating).toBe(mockOrchestrator.biometricValidating);
        });

        it('debe exponer biometricError del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            expect(component.biometricError).toBe(mockOrchestrator.biometricError);
        });

        it('debe exponer biometricSuccess del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            expect(component.biometricSuccess).toBe(mockOrchestrator.biometricSuccess);
        });

        it('debe exponer logs del orchestrator', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            expect(component.logs).toBe(mockOrchestrator.logs);
        });
    });

    // ═══════════════════════════════════════════════════
    // Badge de Evidencias Offline - Integración
    // ═══════════════════════════════════════════════════

    describe('Badge de evidencias offline', () => {
        beforeEach(async () => {
            // Resetear el signal antes de cada test
            mockPendingCountSignal.set(0);
            mockOrchestrator.isOnline.set(true);
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
        });

        it('debe mostrar el badge cuando está offline Y hay evidencias pendientes', () => {
            // Configurar estado: offline + pendientes
            mockOrchestrator.isOnline.set(false);
            mockPendingCountSignal.set(3);
            fixture.detectChanges();

            const badge = fixture.nativeElement.querySelector('.offline-badge');
            expect(badge).toBeTruthy();
            expect(badge.textContent).toContain('3');
            expect(badge.textContent).toContain('evidencias');
        });

        it('debe mostrar el badge con singular cuando hay 1 evidencia pendiente', () => {
            mockOrchestrator.isOnline.set(false);
            mockPendingCountSignal.set(1);
            fixture.detectChanges();

            const badge = fixture.nativeElement.querySelector('.offline-badge');
            expect(badge).toBeTruthy();
            expect(badge.textContent).toContain('1');
            expect(badge.textContent).toContain('evidencia');
        });

        it('NO debe mostrar el badge cuando está online aunque haya evidencias pendientes', () => {
            // Configurar estado: online + pendientes
            mockOrchestrator.isOnline.set(true);
            mockPendingCountSignal.set(5);
            fixture.detectChanges();

            const badge = fixture.nativeElement.querySelector('.offline-badge');
            expect(badge).toBeFalsy();
        });

        it('NO debe mostrar el badge cuando está offline pero sin evidencias pendientes', () => {
            // Configurar estado: offline + sin pendientes
            mockOrchestrator.isOnline.set(false);
            mockPendingCountSignal.set(0);
            fixture.detectChanges();

            const badge = fixture.nativeElement.querySelector('.offline-badge');
            expect(badge).toBeFalsy();
        });

        it('NO debe mostrar el badge cuando está online y sin evidencias pendientes', () => {
            mockOrchestrator.isOnline.set(true);
            mockPendingCountSignal.set(0);
            fixture.detectChanges();

            const badge = fixture.nativeElement.querySelector('.offline-badge');
            expect(badge).toBeFalsy();
        });
    });

    // ═══════════════════════════════════════════════════
    // Cleanup
    // ═══════════════════════════════════════════════════

    describe('Cleanup (ngOnDestroy)', () => {
        it('debe llamar destroy del orchestrator al destruirse', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            
            component.ngOnDestroy();
            
            expect(mockOrchestrator.destroy).toHaveBeenCalled();
        });
    });

    //═══════════════════════════════════════════════════╗
    // REQ-SW-001 & REQ-SW-002: Session Recovery Flow
    // ═══════════════════════════════════════════════════

    describe('Session Recovery Flow', () => {
        it('debe mostrar el diálogo de recuperación cuando existe una sesión persistida', fakeAsync(async () => {
            const persistedState = createTestPersistedState();
            mockSessionStorage.loadState.and.resolveTo(persistedState);

            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            tick();

            await fixture.whenStable();
            tick();

            // El diálogo de recuperación debe ser visible
            expect(component.showRecoveryModal()).toBe(true);
            expect(component.recoveryState()).toEqual(persistedState);
        }));

        it('NO debe mostrar diálogo si no hay sesión persistida', fakeAsync(async () => {
            mockSessionStorage.loadState.and.resolveTo(null);

            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            tick();

            await fixture.whenStable();
            tick();

            expect(component.showRecoveryModal()).toBe(false);
            expect(component.recoveryState()).toBeNull();
        }));

        it('debe limpiar sesión stale cuando examSessionId no coincide', fakeAsync(async () => {
            // Sesión persistida con ID diferente
            const staleState = createTestPersistedState({ examSessionId: 'old-session-id' });
            mockSessionStorage.loadState.and.resolveTo(staleState);
            mockSessionStorage.clearState.and.resolveTo();

            fixture.componentRef.setInput('config', buildConfig({ sessionContext: { examSessionId: 'new-session-id' } as any }));
            fixture.detectChanges();
            tick();

            await fixture.whenStable();
            tick();

            // Debe limpiar la sesión stale
            expect(mockSessionStorage.clearState).toHaveBeenCalledWith('old-session-id');
            // NO debe mostrar diálogo
            expect(component.showRecoveryModal()).toBe(false);
        }));

        it('NO debe mostrar diálogo si el tiempo del examen ha expirado', fakeAsync(async () => {
            // Sesión que comenzó hace más tiempo que la duración del examen
            const expiredState = createTestPersistedState({
                examStartedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            });
            mockSessionStorage.loadState.and.resolveTo(expiredState);

            fixture.componentRef.setInput('config', buildConfig({ sessionContext: { durationMinutes: 30 } as any }));
            fixture.detectChanges();
            tick();

            await fixture.whenStable();
            tick();

            // Sesión expirada = limpiar y no mostrar diálogo
            expect(mockSessionStorage.clearState).toHaveBeenCalled();
            expect(component.showRecoveryModal()).toBe(false);
        }));

        it('debe continuar con sesión recuperada cuando el usuario elige "Continuar"', fakeAsync(async () => {
            const persistedState = createTestPersistedState({ proctoringState: 'MONITORING' });
            mockSessionStorage.loadState.and.resolveTo(persistedState);
            mockOrchestrator.extractState.and.returnValue({
                proctoringState: 'MONITORING',
                totalViolations: 0,
                tabSwitchCount: 0,
                remoteSessionId: 'remote-123',
            });

            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            tick();

            await fixture.whenStable();
            tick();

            // Simular elección del usuario: Continuar
            await component.handleRecoveryContinue();
            tick();

            // Debe inicializar con recuperación
            expect(mockOrchestrator.initialize).toHaveBeenCalled();
            expect(component.showRecoveryModal()).toBe(false);
        }));

        it('debe iniciar sesión nueva cuando el usuario elige "Empezar de nuevo"', fakeAsync(async () => {
            const persistedState = createTestPersistedState();
            mockSessionStorage.loadState.and.resolveTo(persistedState);
            mockSessionStorage.clearState.and.resolveTo();

            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            tick();

            await fixture.whenStable();
            tick();

            // Simular elección del usuario: Empezar de nuevo
            await component.handleRecoveryStartFresh();
            tick();

            // Debe limpiar sesión y iniciar fresh
            expect(mockSessionStorage.clearState).toHaveBeenCalledWith('sess-1');
            expect(mockOrchestrator.initialize).toHaveBeenCalled();
            expect(component.showRecoveryModal()).toBe(false);
        }));

        it('debe mostrar resumen de recuperación correcto', fakeAsync(async () => {
            const persistedState = createTestPersistedState({
                answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' },
                examStartedAt: new Date(Date.now() -1200000).toISOString(), // 20 min ago
            });
            mockSessionStorage.loadState.and.resolveTo(persistedState);

            fixture.componentRef.setInput('config', buildConfig({ sessionContext: { durationMinutes: 30 } as any }));
            fixture.detectChanges();
            tick();

            await fixture.whenStable();
            tick();

            expect(component.showRecoveryModal()).toBe(true);

            // Verificar computed recoverySummary
            const summary = component.recoverySummary();
            expect(summary).toBeTruthy();
            expect(summary!.answeredCount).toBe(5);
            //30min - 20min = 10min remaining (approximately)
            expect(summary!.remainingMinutes).toBeGreaterThanOrEqual(9);
        }));

        it('debe llamar clearState al finalizar el examen', fakeAsync(async () => {
            mockSessionStorage.clearState.and.resolveTo();

            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            tick();

            await fixture.whenStable();

            // Simular finalización del examen
            component.handleExamFinished({ answers: { 1: 'A' }, completedAt: new Date().toISOString() });
            tick();

            expect(mockSessionStorage.clearState).toHaveBeenCalledWith('sess-1');
        }));
    });

    // ═══════════════════════════════════════════════════
    // Rolling Coverage: Recovery Signals
    // ═══════════════════════════════════════════════════

    describe('Recovery Signals', () => {
        it('recoverySummary debe ser null cuando no hay recoveryState', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();

            component.recoveryState.set(null);

            expect(component.recoverySummary()).toBeNull();
            discardPeriodicTasks();
        }));

        it('recoverySummary debe calcular minutos y respuestas correctamente', fakeAsync(() => {
            fixture.componentRef.setInput('config', buildConfig({ sessionContext: { durationMinutes: 60 } as any }));
            fixture.detectChanges();

            component.recoveryState.set(createTestPersistedState({
                answers: { 1: 'A', 2: 'B', 3: 'C' },
                examStartedAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
            }));

            const summary = component.recoverySummary();
            expect(summary).toBeTruthy();
            expect(summary!.answeredCount).toBe(3);
            //60min - 30min = 30min remaining
            expect(summary!.remainingMinutes).toBeGreaterThanOrEqual(29);

            discardPeriodicTasks();
        }));
    });

    // ═══════════════════════════════════════════════════
    // IndexedDB Availability
    // ═══════════════════════════════════════════════════

    describe('IndexedDB Availability', () => {
        it('debe funcionar incluso si IndexedDB no está disponible (modo privado)', fakeAsync(async () => {
            // El componente verifica SessionStorageService.isAvailable() antes de cargar
            // Si retorna false, no intenta cargar sesión y continúa con flujo normal
            mockSessionStorage.loadState.and.resolveTo(null);

            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            tick();

            await fixture.whenStable();

            // El componente debe inicializarse normalmente sin mostrar diálogo de recuperación
            expect(component.showRecoveryModal()).toBe(false);
            discardPeriodicTasks();
        }));
    });
});