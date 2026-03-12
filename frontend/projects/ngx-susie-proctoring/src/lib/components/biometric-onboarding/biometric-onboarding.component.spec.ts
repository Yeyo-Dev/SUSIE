import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ElementRef } from '@angular/core';
import { BiometricOnboardingComponent } from './biometric-onboarding.component';
import { MediaService } from '@lib/services/media.service';

// ── Stub del sub-componente StepIndicator ──
@Component({ selector: 'susie-step-indicator', standalone: true, template: '' })
class StubStepIndicatorComponent { }

describe('BiometricOnboardingComponent', () => {
    let component: BiometricOnboardingComponent;
    let fixture: ComponentFixture<BiometricOnboardingComponent>;
    let mockMediaService: jasmine.SpyObj<MediaService>;
    let mockStream: MediaStream;

    beforeEach(async () => {
        // Crear un MediaStream falso
        mockStream = {
            getTracks: () => [],
            getVideoTracks: () => [],
            getAudioTracks: () => [],
        } as unknown as MediaStream;

        mockMediaService = jasmine.createSpyObj('MediaService', ['stream', 'requestPermissions']);
        mockMediaService.stream.and.returnValue(mockStream);

        await TestBed.configureTestingModule({
            imports: [BiometricOnboardingComponent],
            providers: [
                { provide: MediaService, useValue: mockMediaService },
            ],
        })
            .overrideComponent(BiometricOnboardingComponent, {
                remove: { imports: [/* original StepIndicatorComponent */] },
                add: { imports: [StubStepIndicatorComponent] },
            })
            .compileComponents();

        fixture = TestBed.createComponent(BiometricOnboardingComponent);
        component = fixture.componentInstance;
    });

    // ═══════════════════════════════════════════════════
    // 2.2 — Creación básica del componente
    // ═══════════════════════════════════════════════════

    it('debe crear el componente', () => {
        expect(component).toBeTruthy();
    });

    // ═══════════════════════════════════════════════════
    // 2.3 — startCamera
    // ═══════════════════════════════════════════════════

    describe('startCamera', () => {
        it('debe asignar el stream del MediaService al videoElement', async () => {
            // Crear video mock con srcObject interceptado via defineProperty
            const mockVideo = document.createElement('video');
            let assignedSrcObj: any = null;
            Object.defineProperty(mockVideo, 'srcObject', {
                set: (val: any) => { assignedSrcObj = val; },
                get: () => assignedSrcObj,
                configurable: true,
            });
            component.videoElement = { nativeElement: mockVideo } as ElementRef<HTMLVideoElement>;

            await component.startCamera();

            expect(assignedSrcObj).toBe(mockStream);
            expect(mockVideo.muted).toBeTrue();
        });

        it('no debe fallar si videoElement no está disponible', async () => {
            // videoElement no definido (antes de AfterViewInit)
            (component as any).videoElement = undefined;
            await expectAsync(component.startCamera()).toBeResolved();
        });
    });

    // ═══════════════════════════════════════════════════
    // 2.4 — capturePhoto
    // ═══════════════════════════════════════════════════

    describe('capturePhoto', () => {
        it('debe generar capturedImage (dataURL) cuando se captura', () => {
            // Crear mock de video element con dimensiones
            const mockVideo = document.createElement('video');
            Object.defineProperty(mockVideo, 'videoWidth', { value: 640 });
            Object.defineProperty(mockVideo, 'videoHeight', { value: 480 });
            component.videoElement = { nativeElement: mockVideo } as ElementRef<HTMLVideoElement>;

            // Spy en createElement para interceptar el canvas
            const mockCtx = {
                drawImage: jasmine.createSpy('drawImage'),
            };
            const mockCanvas = {
                width: 0,
                height: 0,
                getContext: jasmine.createSpy('getContext').and.returnValue(mockCtx),
                toDataURL: jasmine.createSpy('toDataURL').and.returnValue('data:image/jpeg;base64,fake'),
                toBlob: jasmine.createSpy('toBlob').and.callFake((cb: (b: Blob | null) => void) => {
                    cb(new Blob(['fake'], { type: 'image/jpeg' }));
                }),
            };
            spyOn(document, 'createElement').and.returnValue(mockCanvas as any);

            component.capturePhoto();

            expect(mockCtx.drawImage).toHaveBeenCalledWith(mockVideo, 0, 0);
            expect(component.capturedImage()).toBe('data:image/jpeg;base64,fake');
        });

        it('no debe fallar si videoElement no está disponible', () => {
            (component as any).videoElement = undefined;
            expect(() => component.capturePhoto()).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════════════
    // 2.5 — retakePhoto
    // ═══════════════════════════════════════════════════

    describe('retakePhoto', () => {
        it('debe limpiar capturedImage y emitir retakeRequested', () => {
            component.capturedImage.set('data:image/jpeg;base64,old');
            spyOn(component.retakeRequested, 'emit');

            component.retakePhoto();

            expect(component.capturedImage()).toBeNull();
            expect(component.retakeRequested.emit).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════
    // 2.6 — confirmPhoto
    // ═══════════════════════════════════════════════════

    describe('confirmPhoto', () => {
        it('debe emitir completed con el Blob capturado', () => {
            const fakeBlob = new Blob(['test'], { type: 'image/jpeg' });
            (component as any).capturedBlob = fakeBlob;
            spyOn(component.completed, 'emit');

            component.confirmPhoto();

            expect(component.completed.emit).toHaveBeenCalledWith({ photo: fakeBlob });
        });

        it('no debe emitir si no hay blob capturado', () => {
            (component as any).capturedBlob = null;
            spyOn(component.completed, 'emit');

            component.confirmPhoto();

            expect(component.completed.emit).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════
    // 2.7 — Estado de validación (inputs reactivos)
    // ═══════════════════════════════════════════════════

    describe('Estados de validación', () => {
        it('showSuccess debe ser true cuando validationSuccess input es true', () => {
            fixture.componentRef.setInput('validationSuccess', true);
            fixture.detectChanges();
            expect(component.showSuccess()).toBeTrue();
        });

        it('showSuccess debe ser false cuando validationSuccess input es false', () => {
            fixture.componentRef.setInput('validationSuccess', false);
            fixture.detectChanges();
            expect(component.showSuccess()).toBeFalse();
        });
    });
});
