import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PermissionPrepComponent } from './permission-prep.component';
import { MediaService } from '../../services/media.service';
import { ChangeDetectionStrategy } from '@angular/core';

describe('PermissionPrepComponent', () => {
  let component: PermissionPrepComponent;
  let fixture: ComponentFixture<PermissionPrepComponent>;
  let mediaService: MediaService;

  // Mock de MediaStream
  const mockMediaStream = {
    getTracks: () => [],
    addTrack: () => {},
    removeTrack: () => {}
  } as unknown as MediaStream;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionPrepComponent],
      providers: [MediaService]
    })
    .overrideComponent(PermissionPrepComponent, {
      set: { changeDetection: ChangeDetectionStrategy.Default }
    })
    .compileComponents();

    fixture = TestBed.createComponent(PermissionPrepComponent);
    component = fixture.componentInstance;
    mediaService = TestBed.inject(MediaService);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  // ============================================
  // ESCENARIO: REQ-01 - Iconos animados
  // ============================================
  describe('REQ-01: Iconos animados', () => {
    it('debe mostrar icono de cámara cuando requireCamera es true', () => {
      // Los inputs de signal son de solo lectura en runtime, verificamos la lógica
      expect(component.showCamera()).toBe(true);
    });

    it('debe mostrar icono de micrófono cuando requireMicrophone es true', () => {
      // Verificamos que showMic funciona correctamente
      expect(component.showMic()).toBe(true);
    });
  });

  // ============================================
  // ESCENARIO: REQ-02 - Texto explicativo
  // ============================================
  describe('REQ-02: Texto explicativo', () => {
    it('debe mostrar texto de preparación en estado preparing', () => {
      expect(component.state()).toBe('preparing');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const text = compiled.querySelector('.prep-subtitle');
      expect(text).toBeTruthy();
      expect(text?.textContent).toContain('dispositivos');
    });
  });

  // ============================================
  // ESCENARIO: REQ-03 - Botón Continuar
  // ============================================
  describe('REQ-03: Botón Continuar dispara solicitud', () => {
    it('debe tener texto "Continuar" en estado preparing', () => {
      expect(component.buttonText()).toBe('Continuar');
    });

    it('debe cambiar estado a requesting al hacer click y mantenerlo brevemente', fakeAsync(() => {
      // Mock de getUserMedia que tarda un poco
      let resolveFn: (stream: MediaStream) => void;
      const mockPromise = new Promise<MediaStream>((resolve) => {
        resolveFn = resolve;
      });
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(mockPromise);

      component.onContinue();
      
      // El estado debería ser requesting inmediatamente después de llamar
      expect(component.state()).toBe('requesting');
      
      // Ahora resolvemos la promesa
      resolveFn!(mockMediaStream);
      tick();
      
      // Después de resolver, cambia a granted
      expect(component.state()).toBe('granted');
    }));
  });

  // ============================================
  // ESCENARIO: REQ-04 - Preview de cámara
  // ============================================
  describe('REQ-04: Preview de cámara', () => {
    it('debe mostrar preview cuando estado es granted', () => {
      component.state.set('granted');
      mediaService.stream.set(mockMediaStream);
      fixture.detectChanges();

      expect(component.showPreview()).toBe(true);
    });

    it('no debe mostrar preview cuando estado no es granted', () => {
      component.state.set('preparing');
      mediaService.stream.set(null);
      fixture.detectChanges();

      expect(component.showPreview()).toBe(false);
    });
  });

  // ============================================
  // ESCENARIO: REQ-05 - Botón "Comenzar Examen"
  // ============================================
  describe('REQ-05: Botón cambia a Comenzar Examen', () => {
    it('debe tener texto "Comenzar Examen" en estado granted', () => {
      component.state.set('granted');
      expect(component.buttonText()).toBe('Comenzar Examen');
    });
  });

  // ============================================
  // ESCENARIO: REQ-06 - Emite permissionPrepared
  // ============================================
  describe('REQ-06: Emite permissionPrepared al confirmar', () => {
    it('debe emitir permissionPrepared cuando se confirma en granted', fakeAsync(() => {
      spyOn(component.permissionPrepared, 'emit');

      component.state.set('granted');
      component.onContinue();
      tick();

      expect(component.permissionPrepared.emit).toHaveBeenCalled();
    }));

    it('NO debe emitir permissionPrepared en estado preparing', fakeAsync(() => {
      spyOn(component.permissionPrepared, 'emit');
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(
        Promise.resolve(mockMediaStream)
      );

      component.onContinue();
      tick();

      expect(component.permissionPrepared.emit).not.toHaveBeenCalled();
    }));
  });

  // ============================================
  // ESCENARIO: REQ-07 - Manejo de errores
  // ============================================
  describe('REQ-07: Manejo de errores con retry', () => {
    it('debe tener texto "Intentar de nuevo" en estado denied', () => {
      component.state.set('denied');
      expect(component.buttonText()).toBe('Intentar de nuevo');
    });

    it('debe resetear al estado preparing al hacer retry', fakeAsync(() => {
      component.state.set('denied');
      component.hasError.set(true);
      component.errorMessage.set('Permiso denegado');

      component.onContinue();
      tick();

      expect(component.state()).toBe('preparing');
      expect(component.hasError()).toBe(false);
    }));

    it('debe manejar error cuando getUserMedia falla', fakeAsync(() => {
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(
        Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
      );

      component.onContinue();
      tick();

      expect(component.state()).toBe('denied');
      expect(component.hasError()).toBe(true);
    }));
  });

  // ============================================
  // ESCENARIO: REQ-08 - Animaciones fluidas
  // ============================================
  describe('REQ-08: Animaciones CSS', () => {
    it('debe tener iconPulse keyframes en CSS', () => {
      // Verificar que el archivo CSS existe y contiene las animaciones
      const style = fixture.nativeElement.ownerDocument.querySelector('style');
      expect(style?.textContent).toContain('iconPulse');
    });
  });

  // ============================================
  // ESCENARIO: REQ-09 - Responsive
  // ============================================
  describe('REQ-09: Responsive design', () => {
    it('debe tener estilos responsive en CSS', () => {
      // Verificar que el CSS tiene media queries
      const style = fixture.nativeElement.ownerDocument.querySelector('style');
      expect(style?.textContent).toContain('640px');
    });
  });

  // ============================================
  // ESCENARIO: REQ-10 - prefers-reduced-motion
  // ============================================
  describe('REQ-10: prefers-reduced-motion', () => {
    it('debe incluir prefers-reduced-motion en CSS', () => {
      const style = fixture.nativeElement.ownerDocument.querySelector('style');
      expect(style?.textContent).toContain('reduced-motion');
    });
  });

  // ============================================
  // Tests adicionales de comportamiento
  // ============================================
  describe('Comportamiento adicional', () => {
    it('debe deshabilitar botón en estado requesting', () => {
      component.state.set('requesting');
      expect(component.isButtonDisabled()).toBe(true);
    });

    it('debe habilitar botón en otros estados', () => {
      component.state.set('preparing');
      expect(component.isButtonDisabled()).toBe(false);

      component.state.set('granted');
      expect(component.isButtonDisabled()).toBe(false);

      component.state.set('denied');
      expect(component.isButtonDisabled()).toBe(false);
    });

    it('debe emitir permissionRequested al solicitar permisos', fakeAsync(() => {
      spyOn(component.permissionPrepared, 'emit');
      spyOn(component.permissionRequested, 'emit');
      spyOn(navigator.mediaDevices, 'getUserMedia').and.returnValue(
        Promise.resolve(mockMediaStream)
      );

      component.onContinue();
      tick();

      expect(component.permissionRequested.emit).toHaveBeenCalled();
    }));
  });
});
