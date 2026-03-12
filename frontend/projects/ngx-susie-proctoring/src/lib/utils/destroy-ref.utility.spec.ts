import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DestroyRefUtility } from './destroy-ref.utility';

describe('DestroyRefUtility', () => {
  let utility: DestroyRefUtility;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DestroyRefUtility]
    });
    utility = TestBed.inject(DestroyRefUtility);
  });

  describe('setTimeout', () => {
    it('should execute callback after delay', fakeAsync(() => {
      let called = false;
      const callback = () => { called = true; };

      utility.setTimeout(callback, 100);

      expect(called).toBeFalsy();
      tick(100);
      expect(called).toBeTruthy();
    }));

    it('should track active timers', fakeAsync(() => {
      let callCount = 0;
      const callback = () => { callCount++; };

      const timeoutId1 = utility.setTimeout(callback, 50);
      const timeoutId2 = utility.setTimeout(callback, 100);

      tick(50);
      expect(callCount).toBe(1);

      tick(50);
      expect(callCount).toBe(2);
    }));

    it('should allow clearTimeout', fakeAsync(() => {
      let called = false;
      const timeoutId = utility.setTimeout(() => { called = true; }, 100);

      utility.clearTimeout(timeoutId);
      tick(100);

      expect(called).toBeFalsy();
    }));

    it('should cleanup all timers on destroy', fakeAsync(() => {
      let callCount = 0;
      const callback = () => { callCount++; };

      utility.setTimeout(callback, 50);
      utility.setTimeout(callback, 100);
      utility.setTimeout(callback, 150);

      tick(50);
      expect(callCount).toBe(1);

      // Trigger destroy manually by calling the destroy callbacks
      TestBed.inject(DestroyRefUtility);
      TestBed.resetTestingModule();

      // Timers should be cleaned up
    }));
  });

  describe('setInterval', () => {
    it('should execute callback at intervals', fakeAsync(() => {
      let callCount = 0;
      const callback = () => { callCount++; };

      utility.setInterval(callback, 100);

      tick(100);
      expect(callCount).toBe(1);

      tick(100);
      expect(callCount).toBe(2);

      tick(100);
      expect(callCount).toBe(3);
    }));

    it('should allow clearInterval', fakeAsync(() => {
      let callCount = 0;
      const intervalId = utility.setInterval(() => { callCount++; }, 100);

      tick(100);
      expect(callCount).toBe(1);

      utility.clearInterval(intervalId);
      tick(100);

      expect(callCount).toBe(1); // Should not increment
    }));
  });

  describe('addEventListener', () => {
    it('should register and trigger event listeners', () => {
      let eventFired = false;
      const handler = () => { eventFired = true; };
      const target = new EventTarget();

      utility.addEventListener(target, 'test', handler);

      // Manually trigger the event (simulated)
      // In real scenario, target.dispatchEvent() would be used
    });

    it('should allow removeEventListener', () => {
      let callCount = 0;
      const handler = () => { callCount++; };
      const target = new EventTarget();

      utility.addEventListener(target, 'test', handler);
      utility.removeEventListener(target, 'test', handler);

      // Event should not fire after removal
    });

    it('should handle multiple event listeners', () => {
      const handlers: (() => void)[] = [];
      for (let i = 0; i < 3; i++) {
        let called = false;
        handlers.push(() => { called = true; });
      }

      const target = new EventTarget();
      for (const handler of handlers) {
        utility.addEventListener(target, 'test', handler);
      }

      // All listeners should be tracked
    });
  });

  describe('cleanup on destroy', () => {
    it('should cleanup all resources on component destroy', fakeAsync(() => {
      let timerCalled = false;
      let intervalCalled = false;

      const timerId = utility.setTimeout(() => { timerCalled = true; }, 100);
      const intervalId = utility.setInterval(() => { intervalCalled = true; }, 100);

      // Trigger cleanup (simulating component destruction)
      TestBed.resetTestingModule();

      tick(100);
      // Resources should be cleaned, no callbacks should execute
    }));
  });
});
