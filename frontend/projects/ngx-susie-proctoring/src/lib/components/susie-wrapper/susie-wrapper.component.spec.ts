import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Component, signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { SusieWrapperComponent } from './susie-wrapper.component';
import { MediaService } from '../../services/media.service';
import { EvidenceService } from '../../services/evidence.service';
import { SecurityService } from '../../services/security.service';
import { NetworkMonitorService } from '../../services/network-monitor.service';
import { InactivityService } from '../../services/inactivity.service';
import { GazeTrackingService } from '../../services/gaze-tracking.service';
import { WebSocketFeedbackService } from '../../services/websocket-feedback.service';
import { SusieConfig, SecurityViolation, ExamResult, ConsentResult } from '../../models/contracts';

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
function buildConfig(overrides: Partial<SusieConfig> = {}): SusieConfig {
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

describe('SusieWrapperComponent', () => {
    let component: SusieWrapperComponent;
    let fixture: ComponentFixture<SusieWrapperComponent>;

    // Mocks de servicios
    let mockMediaService: any;
    let mockEvidenceService: any;
    let mockSecurityService: any;
    let mockNetworkService: any;
    let mockInactivityService: any;
    let mockGazeService: any;
    let mockFeedbackService: any;

    beforeEach(async () => {
        mockMediaService = {
            stream: signal(null),
            error: signal(null),
            stop: jasmine.createSpy('stop'),
            getAudioStream: jasmine.createSpy('getAudioStream').and.returnValue(null),
            requestPermissions: jasmine.createSpy('requestPermissions').and.resolveTo(),
        };

        mockEvidenceService = {
            configure: jasmine.createSpy('configure'),
            setLogger: jasmine.createSpy('setLogger'),
            sendEvent: jasmine.createSpy('sendEvent'),
            sendGazeData: jasmine.createSpy('sendGazeData'),
            startAudioRecording: jasmine.createSpy('startAudioRecording'),
            stopAudioRecording: jasmine.createSpy('stopAudioRecording'),
            startSession: jasmine.createSpy('startSession').and.resolveTo('session-123'),
            endSession: jasmine.createSpy('endSession'),
            validateBiometric: jasmine.createSpy('validateBiometric').and.resolveTo(true),
            finishExam: jasmine.createSpy('finishExam'),
        };

        mockSecurityService = {
            enableProtection: jasmine.createSpy('enableProtection'),
            disableProtection: jasmine.createSpy('disableProtection'),
            enterFullscreen: jasmine.createSpy('enterFullscreen').and.resolveTo(),
        };

        mockNetworkService = {
            isOnline: signal(true),
        };

        mockInactivityService = {
            configure: jasmine.createSpy('configure'),
            startMonitoring: jasmine.createSpy('startMonitoring'),
            stopMonitoring: jasmine.createSpy('stopMonitoring'),
            resetTimer: jasmine.createSpy('resetTimer'),
            showWarning: signal(false),
        };

        mockGazeService = {
            configure: jasmine.createSpy('configure'),
            stop: jasmine.createSpy('stop'),
            isCalibrated: jasmine.createSpy('isCalibrated').and.returnValue(false),
            flushGazeBuffer: jasmine.createSpy('flushGazeBuffer').and.returnValue([]),
        };

        mockFeedbackService = {
            connect: jasmine.createSpy('connect'),
            disconnect: jasmine.createSpy('disconnect'),
            currentAlert: signal(null),
        };

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
                        { provide: MediaService, useValue: mockMediaService },
                        { provide: EvidenceService, useValue: mockEvidenceService },
                        { provide: SecurityService, useValue: mockSecurityService },
                        { provide: NetworkMonitorService, useValue: mockNetworkService },
                        { provide: InactivityService, useValue: mockInactivityService },
                        { provide: GazeTrackingService, useValue: mockGazeService },
                        { provide: WebSocketFeedbackService, useValue: mockFeedbackService },
                    ],
                },
            })
            .compileComponents();

        fixture = TestBed.createComponent(SusieWrapperComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        // Limpiar listeners globales que el componente agrega en ngOnInit
        try { component.ngOnDestroy(); } catch (_) { /* ignore */ }
    });

    // ═══════════════════════════════════════════════════
    // 4.2 — Creación del componente
    // ═══════════════════════════════════════════════════

    it('debe crear el componente', () => {
        fixture.componentRef.setInput('config', buildConfig());
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    // ═══════════════════════════════════════════════════
    // 4.3 — Configuración de EvidenceService
    // ═══════════════════════════════════════════════════

    describe('Configuración inicial', () => {
        it('debe configurar evidenceService al recibir config', () => {
            const cfg = buildConfig();
            fixture.componentRef.setInput('config', cfg);
            fixture.detectChanges();

            expect(mockEvidenceService.configure).toHaveBeenCalledWith(
                cfg.apiUrl,
                cfg.authToken,
                cfg.sessionContext
            );
        });

        it('debe configurar inactivityService con el timeout de la config', () => {
            fixture.componentRef.setInput('config', buildConfig({ inactivityTimeoutMinutes: 5 }));
            fixture.detectChanges();

            expect(mockInactivityService.configure).toHaveBeenCalledWith(5, undefined);
        });
    });

    // ═══════════════════════════════════════════════════
    // 4.4 — Flujo de estados
    // ═══════════════════════════════════════════════════

    describe('Transiciones de estado', () => {
        it('debe ir a PERMISSION_PREP cuando requiere cámara', async () => {
            fixture.componentRef.setInput('config', buildConfig({
                securityPolicies: {
                    requireCamera: true,
                    requireMicrophone: false,
                    requireFullscreen: true,
                    requireConsent: true,
                } as any,
            }));
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.state()).toBe('PERMISSION_PREP');
        });

        it('debe ir a CONSENT cuando no requiere permisos especiales pero sí consentimiento', async () => {
            fixture.componentRef.setInput('config', buildConfig({
                securityPolicies: {
                    requireCamera: false,
                    requireMicrophone: false,
                    requireFullscreen: true,
                    requireConsent: true,
                } as any,
            }));
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.state()).toBe('CONSENT');
        });

        it('handleConsent con accepted=true debe avanzar al siguiente paso', () => {
            fixture.componentRef.setInput('config', buildConfig({
                securityPolicies: {
                    requireCamera: false,
                    requireMicrophone: false,
                    requireFullscreen: true,
                    requireConsent: true,
                    requireBiometrics: false,
                    requireEnvironmentCheck: false,
                    requireGazeTracking: false,
                } as any,
            }));
            fixture.detectChanges();

            component.handleConsent({
                accepted: true,
                timestamp: new Date().toISOString(),
                permissionsConsented: ['camera'],
            });

            // Sin biometría ni env check → debería ir a EXAM_BRIEFING
            expect(component.state()).toBe('EXAM_BRIEFING');
        });

        it('handleConsent con accepted=true y requireBiometrics debe ir a BIOMETRIC_CHECK', () => {
            fixture.componentRef.setInput('config', buildConfig({
                securityPolicies: {
                    requireCamera: false,
                    requireMicrophone: false,
                    requireFullscreen: true,
                    requireConsent: true,
                    requireBiometrics: true,
                } as any,
            }));
            fixture.detectChanges();

            component.handleConsent({
                accepted: true,
                timestamp: new Date().toISOString(),
                permissionsConsented: ['camera', 'biometrics'],
            });

            expect(component.state()).toBe('BIOMETRIC_CHECK');
        });

        it('handleBriefingAcknowledged debe ir a MONITORING', async () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            await fixture.whenStable();

            component.handleBriefingAcknowledged();
            await fixture.whenStable();

            expect(component.state()).toBe('MONITORING');
        });
    });

    // ═══════════════════════════════════════════════════
    // 4.5 — Manejo de violaciones
    // ═══════════════════════════════════════════════════

    describe('Manejo de violaciones', () => {
        beforeEach(async () => {
            fixture.componentRef.setInput('config', buildConfig({ maxTabSwitches: 3 }));
            fixture.detectChanges();
            await fixture.whenStable();
            // Llevar al estado de monitoreo
            component.handleBriefingAcknowledged();
            await fixture.whenStable();
        });

        it('debe incrementar el conteo de tab switches en violaciones TAB_SWITCH', () => {
            const violation: SecurityViolation = {
                type: 'TAB_SWITCH',
                message: 'Cambió de pestaña',
                timestamp: new Date().toISOString(),
            };

            (component as any).handleViolation(violation);
            expect(component.tabSwitchCount()).toBe(1);
        });

        it('debe enviar evento al backend por cada violación', () => {
            const violation: SecurityViolation = {
                type: 'INSPECTION_ATTEMPT',
                message: 'DevTools',
                timestamp: new Date().toISOString(),
            };

            (component as any).handleViolation(violation);
            expect(mockEvidenceService.sendEvent).toHaveBeenCalled();
        });

        it('FULLSCREEN_EXIT debe activar needsFullscreenReturn', () => {
            const violation: SecurityViolation = {
                type: 'FULLSCREEN_EXIT',
                message: 'Salió de fullscreen',
                timestamp: new Date().toISOString(),
            };

            (component as any).handleViolation(violation);
            expect(component.needsFullscreenReturn()).toBeTrue();
        });
    });

    // ═══════════════════════════════════════════════════
    // 4.6 — Recuperación de fullscreen y foco
    // ═══════════════════════════════════════════════════

    describe('Recuperación', () => {
        beforeEach(async () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('returnToFullscreen debe restaurar fullscreen y limpiar needsFullscreenReturn', async () => {
            component.needsFullscreenReturn.set(true);
            await component.returnToFullscreen();
            expect(mockSecurityService.enterFullscreen).toHaveBeenCalled();
            expect(component.needsFullscreenReturn()).toBeFalse();
        });

        it('returnToFocus debe limpiar needsFocusReturn', () => {
            component.needsFocusReturn.set(true);
            component.returnToFocus();
            expect(component.needsFocusReturn()).toBeFalse();
        });

        it('confirmActivity debe resetear el timer de inactividad', () => {
            component.confirmActivity();
            expect(mockInactivityService.resetTimer).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════
    // 4.7 — Finalización del examen
    // ═══════════════════════════════════════════════════

    describe('Finalización del examen', () => {
        it('handleExamFinished debe enriquecer resultado con proctoringSummary', async () => {
            const onFinished = jasmine.createSpy('onFinished');
            fixture.componentRef.setInput('config', buildConfig({ onExamFinished: onFinished }));
            fixture.detectChanges();
            await fixture.whenStable();

            const examResult: ExamResult = {
                answers: { 1: 'A', 2: 'B' },
                completedAt: new Date().toISOString(),
            };

            component.handleExamFinished(examResult);

            expect(mockFeedbackService.disconnect).toHaveBeenCalled();
            expect(mockEvidenceService.endSession).toHaveBeenCalledWith('submitted');
            expect(onFinished).toHaveBeenCalledTimes(1);

            const enriched = onFinished.calls.first().args[0] as ExamResult;
            expect(enriched.proctoringSummary).toBeTruthy();
            expect(enriched.proctoringSummary!.totalViolations).toBe(0);
            expect(enriched.proctoringSummary!.tabSwitches).toBe(0);
        });
    });

    // ═══════════════════════════════════════════════════
    // ngOnDestroy
    // ═══════════════════════════════════════════════════

    describe('Cleanup (ngOnDestroy)', () => {
        it('debe detener todos los servicios al destruirse', async () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            await fixture.whenStable();

            component.ngOnDestroy();

            expect(mockFeedbackService.disconnect).toHaveBeenCalled();
            expect(mockMediaService.stop).toHaveBeenCalled();
            expect(mockEvidenceService.stopAudioRecording).toHaveBeenCalled();
            expect(mockSecurityService.disableProtection).toHaveBeenCalled();
            expect(mockGazeService.stop).toHaveBeenCalled();
            expect(mockInactivityService.stopMonitoring).toHaveBeenCalled();
        });
    });
});
