import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ConsentDialogComponent } from './consent-dialog.component';
import { SusieConfig, ConsentResult } from '../../models/contracts';

// ── Stub del sub-componente StepIndicator ──
@Component({ selector: 'susie-step-indicator', standalone: true, template: '' })
class StubStepIndicatorComponent { }

// ── Helpers ──
function buildConfig(overrides: Partial<SusieConfig['securityPolicies']> = {}): SusieConfig {
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
            preventTabSwitch: false,
            requireGazeTracking: false,
            ...overrides,
        },
        apiUrl: 'http://localhost',
        authToken: 'tok',
    };
}

describe('ConsentDialogComponent', () => {
    let component: ConsentDialogComponent;
    let fixture: ComponentFixture<ConsentDialogComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ConsentDialogComponent],
        })
            .overrideComponent(ConsentDialogComponent, {
                remove: { imports: [/* original StepIndicatorComponent */] },
                add: { imports: [StubStepIndicatorComponent] },
            })
            .compileComponents();

        fixture = TestBed.createComponent(ConsentDialogComponent);
        component = fixture.componentInstance;
    });

    // ═══════════════════════════════════════════════════
    // 1.3 — Estado inicial
    // ═══════════════════════════════════════════════════

    describe('Estado inicial', () => {
        it('debe iniciar con consentState en "pending"', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            expect(component.consentState()).toBe('pending');
        });

        it('debe iniciar con isChecked en false', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            expect(component.isChecked()).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════
    // 1.4 — Generación dinámica de textos de privacidad
    // ═══════════════════════════════════════════════════

    describe('Generación dinámica de consentItems y privacyNotice', () => {
        it('no debe generar items si no hay permisos activos', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            expect(component.consentItems().length).toBe(0);
        });

        it('debe generar item de cámara cuando requireCamera es true', () => {
            fixture.componentRef.setInput('config', buildConfig({ requireCamera: true }));
            fixture.detectChanges();
            const items = component.consentItems();
            expect(items.some(i => i.permission === 'camera')).toBeTrue();
        });

        it('debe generar item de micrófono cuando requireMicrophone es true', () => {
            fixture.componentRef.setInput('config', buildConfig({ requireMicrophone: true }));
            fixture.detectChanges();
            const items = component.consentItems();
            expect(items.some(i => i.permission === 'microphone')).toBeTrue();
        });

        it('debe generar item de biometría cuando requireBiometrics es true', () => {
            fixture.componentRef.setInput('config', buildConfig({ requireBiometrics: true }));
            fixture.detectChanges();
            const items = component.consentItems();
            expect(items.some(i => i.permission === 'biometrics')).toBeTrue();
        });

        it('debe generar item de gazeTracking cuando requireGazeTracking es true', () => {
            fixture.componentRef.setInput('config', buildConfig({ requireGazeTracking: true }));
            fixture.detectChanges();
            const items = component.consentItems();
            expect(items.some(i => (i.permission as any) === 'gazeTracking')).toBeTrue();
        });

        it('debe generar item de fullscreen cuando preventTabSwitch es true', () => {
            fixture.componentRef.setInput('config', buildConfig({ preventTabSwitch: true }));
            fixture.detectChanges();
            const items = component.consentItems();
            expect(items.some(i => (i.permission as any) === 'fullscreen')).toBeTrue();
        });

        it('debe generar múltiples items cuando hay varios permisos activos', () => {
            fixture.componentRef.setInput('config', buildConfig({
                requireCamera: true,
                requireMicrophone: true,
                requireBiometrics: true,
            }));
            fixture.detectChanges();
            expect(component.consentItems().length).toBe(3);
        });

        it('privacyNotice debe reflejar los permisos activos', () => {
            fixture.componentRef.setInput('config', buildConfig({
                requireCamera: true,
                requireMicrophone: true,
            }));
            fixture.detectChanges();
            const notice = component.privacyNotice();
            expect(notice).toContain('imágenes periódicas de tu cámara');
            expect(notice).toContain('grabaciones de audio del entorno');
        });

        it('privacyNotice debe usar texto default cuando no hay permisos de hardware', () => {
            fixture.componentRef.setInput('config', buildConfig());
            fixture.detectChanges();
            expect(component.privacyNotice()).toContain('Se monitorizará tu actividad en el navegador');
        });
    });

    // ═══════════════════════════════════════════════════
    // 1.5 — Acciones del usuario
    // ═══════════════════════════════════════════════════

    describe('Acciones del usuario', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('config', buildConfig({ requireCamera: true }));
            fixture.detectChanges();
        });

        it('onCheckboxChange debe actualizar isChecked', () => {
            const fakeEvent = { target: { checked: true } } as unknown as Event;
            component.onCheckboxChange(fakeEvent);
            expect(component.isChecked()).toBeTrue();
        });

        it('onAccept no debe emitir si isChecked es false', () => {
            spyOn(component.consentGiven, 'emit');
            component.onAccept();
            expect(component.consentGiven.emit).not.toHaveBeenCalled();
        });

        it('onAccept debe emitir ConsentResult con accepted=true cuando isChecked', () => {
            component.isChecked.set(true);
            spyOn(component.consentGiven, 'emit');
            component.onAccept();

            expect(component.consentGiven.emit).toHaveBeenCalledTimes(1);
            const result = (component.consentGiven.emit as jasmine.Spy).calls.first().args[0] as ConsentResult;
            expect(result.accepted).toBeTrue();
            expect(result.permissionsConsented.length).toBeGreaterThan(0);
        });

        it('onReject debe cambiar consentState a "rejected"', () => {
            component.onReject();
            expect(component.consentState()).toBe('rejected');
        });

        it('onReject debe emitir ConsentResult con accepted=false', () => {
            spyOn(component.consentGiven, 'emit');
            component.onReject();

            const result = (component.consentGiven.emit as jasmine.Spy).calls.first().args[0] as ConsentResult;
            expect(result.accepted).toBeFalse();
            expect(result.permissionsConsented).toEqual([]);
        });

        it('onReconsider debe restaurar consentState a "pending" y desmarcar checkbox', () => {
            component.onReject(); // Primero rechazar
            expect(component.consentState()).toBe('rejected');

            component.onReconsider();
            expect(component.consentState()).toBe('pending');
            expect(component.isChecked()).toBeFalse();
        });
    });
});
