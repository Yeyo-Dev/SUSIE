/**
 * Integration Tests: Session Recovery (Crash Recovery)
 * 
 * These tests simulate the full crash recovery flow including:
 * - Browser crash/close → reload → recovery dialog
 * - Session persistence during exam
 * - State restoration after recovery
 * 
 * REQ-SS-001 through REQ-SS-003: Persistence operations
 * REQ-EE-001 through REQ-EE-003: ExamEngine recovery
 * REQ-SW-001 & REQ-SW-002: Recovery UI and validation
 */

import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { SessionStorageService } from '@lib/services/session-storage.service';
import {
  PersistedSessionState,
  SESSION_STATE_VERSION,
  isSessionRecoverable,
  calculateRemainingTime
} from '@lib/models/session-storage.interface';

// ══════════════════════════════════════════════════════════════
// Helper: Database cleanup
// ══════════════════════════════════════════════════════════════

function deleteTestDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('susie_evidence_queue');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

// ══════════════════════════════════════════════════════════════
// Helper: Create test state
// ══════════════════════════════════════════════════════════════

function createFullTestState(overrides: Partial<PersistedSessionState> = {}): PersistedSessionState {
  return {
    examSessionId: 'integration-test-session',
    examId: 'exam-integration-1',
    answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' },
    currentQuestionIndex: 4,
    timerSecondsRemaining: 1500, // 25 min remaining
    examStartedAt: new Date(Date.now() - 300000).toISOString(), // started 5 min ago
    proctoringState: 'MONITORING',
    totalViolations: 2,
    tabSwitchCount: 1,
    remoteSessionId: 'remote-session-123',
    persistedAt: new Date().toISOString(),
    version: SESSION_STATE_VERSION,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// Integration Suite: Full Recovery Flow
// ══════════════════════════════════════════════════════════════

describe('Session Recovery Integration: Crash → Reload → Recovery', () => {
  let service: SessionStorageService;

  beforeEach(async () => {
    await deleteTestDatabase();
    TestBed.configureTestingModule({
      providers: [SessionStorageService],
    });
    service = TestBed.inject(SessionStorageService);
  });

  afterEach(async () => {
    service.ngOnDestroy();
    await deleteTestDatabase();
  });

  // ════════════════════════════════════════════════════════════
  // REQ-SS-001: Persist Session State
  // ════════════════════════════════════════════════════════════

  describe('Scenario 1.1: Successful Persistence', () => {
    it('GIVEN valid session state WHEN saveState() is called THEN state is persisted to IndexedDB', fakeAsync(async () => {
      await service.init();

      const state = createFullTestState();
      await service.saveState(state);

      // Wait for debounce
      tick(600);
      await Promise.resolve();

      const loaded = await service.loadState(state.examSessionId);

      // THEN all fields are persisted atomically
      expect(loaded).toBeTruthy();
      expect(loaded!.examSessionId).toBe(state.examSessionId);
      expect(loaded!.examId).toBe(state.examId);
      expect(loaded!.answers).toEqual(state.answers);
      expect(loaded!.currentQuestionIndex).toBe(state.currentQuestionIndex);
      expect(loaded!.proctoringState).toBe('MONITORING');
      expect(loaded!.totalViolations).toBe(2);
      expect(loaded!.tabSwitchCount).toBe(1);
      expect(loaded!.remoteSessionId).toBe('remote-session-123');

      discardPeriodicTasks();
    }));
  });

  // ════════════════════════════════════════════════════════════
  // REQ-SS-002: Restore Session State
  // ════════════════════════════════════════════════════════════

  describe('Scenario 1.2: Successful Load', () => {
    it('GIVEN persisted session in IndexedDB WHEN loadState() is called THEN complete state is returned', fakeAsync(async () => {
      await service.init();

      // Pre-populate with full state
      const state = createFullTestState({
        answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I', 10: 'J' },
        currentQuestionIndex: 7,
        totalViolations: 5,
        tabSwitchCount: 3,
      });
      await service.saveState(state);
      tick(600);
      await Promise.resolve();

      // Simulate reload: load state
      const loaded = await service.loadState(state.examSessionId);

      // THEN complete state is returned with all fields
      expect(loaded).toBeTruthy();
      expect(Object.keys(loaded!.answers).length).toBe(10);
      expect(loaded!.currentQuestionIndex).toBe(7);
      expect(loaded!.totalViolations).toBe(5);
      expect(loaded!.tabSwitchCount).toBe(3);

      discardPeriodicTasks();
    }));
  });

  describe('Scenario 1.3: No Session Exists', () => {
    it('GIVEN no persisted session WHEN loadState() is called THEN null is returned', async () => {
      await service.init();

      const loaded = await service.loadState('non-existent-session');

      expect(loaded).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════
  // REQ-SS-003: Clear Session
  // ════════════════════════════════════════════════════════════

  describe('Scenario 1.4: Successful Clear', () => {
    it('GIVEN persisted session WHEN clearState() is called THEN session is removed', fakeAsync(async () => {
      await service.init();

      const state = createFullTestState();
      await service.saveState(state);
      tick(600);
      await Promise.resolve();

      expect(await service.hasSession(state.examSessionId)).toBe(true);

      await service.clearState(state.examSessionId);

      expect(await service.hasSession(state.examSessionId)).toBe(false);
      expect(await service.loadState(state.examSessionId)).toBeNull();

      discardPeriodicTasks();
    }));
  });

  describe('Scenario 1.5: Idempotent Clear', () => {
    it('GIVEN no session exists WHEN clearState() is called THEN no error is thrown', async () => {
      await service.init();

      // Should not throw
      await expectAsync(service.clearState('non-existent')).toBeResolved();
    });
  });

  // ════════════════════════════════════════════════════════════
  // REQ-EE-003: Timer Continuation
  // ════════════════════════════════════════════════════════════

  describe('Timer Continuation Logic', () => {
    it('calculates correct remaining time based on startedAt timestamp', () => {
      // Exam started 10 minutes ago, duration is 30 minutes
      const state = createFullTestState({
        examStartedAt: new Date(Date.now() - 600000).toISOString(), // 10 min ago
        timerSecondsRemaining: 1200, // Stale value (20 min)
      });

      const remaining = calculateRemainingTime(state,30);

      // Should calculate:30min - 10min elapsed = 20min remaining
      // Allow for some variance due to test execution time
      expect(remaining).toBeGreaterThanOrEqual(1190); // ~20 min
      expect(remaining).toBeLessThanOrEqual(1200);
    });

    it('returns 0 when exam time has expired', () => {
      // Exam started 35 minutes ago, duration is 30 minutes
      const state = createFullTestState({
        examStartedAt: new Date(Date.now() - 2100000).toISOString(), // 35 min ago
        timerSecondsRemaining: 0,
      });

      const remaining = calculateRemainingTime(state, 30);

      expect(remaining).toBe(0);
    });

    it('caps remaining time at 0 (no negative values)', () => {
      // Exam started 60 minutes ago, duration is 30 minutes
      const state = createFullTestState({
        examStartedAt: new Date(Date.now() - 3600000).toISOString(), // 60 min ago
        timerSecondsRemaining: 0,
      });

      const remaining = calculateRemainingTime(state, 30);

      expect(remaining).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════
  // REQ-SW-002: Session Validation
  // ════════════════════════════════════════════════════════════

  describe('Session Validation (isSessionRecoverable)', () => {
    it('returns true for valid matching session', () => {
      const state = createFullTestState({
        examStartedAt: new Date(Date.now() - 300000).toISOString(), // 5 min ago
      });

      const result = isSessionRecoverable(state, state.examSessionId,30);

      expect(result).toBe(true);
    });

    it('returns false for mismatched examSessionId', () => {
      const state = createFullTestState({
        examSessionId: 'session-a',
        examStartedAt: new Date(Date.now() -300000).toISOString(),
      });

      const result = isSessionRecoverable(state, 'session-b', 30);

      expect(result).toBe(false);
    });

    it('returns false when exam time has expired', () => {
      const state = createFullTestState({
        examStartedAt: new Date(Date.now() - 3600000).toISOString(), // 60 min ago
      });

      const result = isSessionRecoverable(state, state.examSessionId, 30);

      expect(result).toBe(false);
    });

    it('returns false for null state', () => {
      const result = isSessionRecoverable(null, 'any-session', 30);

      expect(result).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Crash Recovery Simulation
  // ════════════════════════════════════════════════════════════

  describe('Full Crash Recovery Flow', () => {
    it('simulates: save → crash → reload → detect → recover', fakeAsync(async () => {
      await service.init();

      // === STEP 1: User starts exam and answers questions ===
      const examSessionId = 'crash-test-session';
      const state = createFullTestState({
        examSessionId,
        answers: {1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I', 10: 'J' },
        currentQuestionIndex: 9, // User was on question 10
        totalViolations: 3,
        tabSwitchCount: 1,
        examStartedAt: new Date(Date.now() - 600000).toISOString(), // started 10 min ago
      });

      // === STEP 2: State is persisted (user continues working) ===
      await service.saveState(state);
      tick(600);
      await Promise.resolve();

      // Simulate debounce behavior: last persistedAt is updated
      const persistedState = await service.loadState(examSessionId);
      expect(persistedState).toBeTruthy();
      expect(Object.keys(persistedState!.answers).length).toBe(10);

      // === STEP 3: Browser crash (simulate by destroying service) ===
      service.ngOnDestroy();

      // === STEP 4: User reopens browser (service inits again) ===
      const newService = TestBed.inject(SessionStorageService);
      await newService.init();

      // === STEP 5: Check for recoverable session ===
      const hasSession = await newService.hasSession(examSessionId);
      expect(hasSession).toBe(true);

      // === STEP 6: Load and validate session ===
      const recoveredState = await newService.loadState(examSessionId);
      expect(recoveredState).toBeTruthy();

      const isRecoverable = isSessionRecoverable(
        recoveredState!,
        examSessionId,30
      );
      expect(isRecoverable).toBe(true);

      // === STEP 7: Calculate remaining time ===
      const remainingTime = calculateRemainingTime(recoveredState!, 30);
      //30min - 10min elapsed = 20min remaining approximately
      expect(remainingTime).toBeGreaterThan(1000); // More than ~16 min

      // User can continue exam with recovered state
      newService.ngOnDestroy();

      discardPeriodicTasks();
    }));

    it('simulates: save → crash → reload → stale session → clear', fakeAsync(async () => {
      await service.init();

      // Create a stale session (wrong session ID or expired)
      const staleSessionId = 'stale-session';
      const newSessionId = 'new-session';

      const staleState = createFullTestState({
        examSessionId: staleSessionId,
        examStartedAt: new Date(Date.now() - 3600000).toISOString(), // expired
      });

      await service.saveState(staleState);
      tick(600);
      await Promise.resolve();

      // Check if session is recoverable for NEW session
      const loadedState = await service.loadState(staleSessionId);
      const isRecoverable = isSessionRecoverable(loadedState!, newSessionId, 30);

      // Should not be recoverable (session ID mismatch OR expired)
      expect(isRecoverable).toBe(false);

      // Clear stale session
      await service.clearState(staleSessionId);
      expect(await service.hasSession(staleSessionId)).toBe(false);

      discardPeriodicTasks();
    }));
  });

  // ════════════════════════════════════════════════════════════
  // Debounce Behavior Verification
  // ════════════════════════════════════════════════════════════

  describe('Debounce Behavior (REQ-SS-001 AC4)', () => {
    it('persists state within 500ms of state change (debounced)', fakeAsync(async () => {
      await service.init();

      const state1 = createFullTestState({ answers: { 1: 'A' } });
      const state2 = createFullTestState({ answers: { 1: 'B' } });
      const state3 = createFullTestState({ answers: { 1: 'C' } });

      // Rapid saves (simulating user answering quickly)
      await service.saveState(state1);
      await service.saveState(state2);
      await service.saveState(state3);

      // Before debounce timeout, load should still return null or old value
      tick(200);
      let loaded = await service.loadState(state1.examSessionId);
      // May or may not have saved yet (debounce in progress)

      // Afterdebounce timeout
      tick(400);
      await Promise.resolve();

      loaded = await service.loadState(state1.examSessionId);
      expect(loaded).toBeTruthy();
      // Last state wins
      expect(loaded!.answers[1]).toBe('C');

      discardPeriodicTasks();
    }));
  });

  // ════════════════════════════════════════════════════════════
  // Multiple Sessions (Different Exams)
  // ════════════════════════════════════════════════════════════

  describe('Multiple Sessions (Concurrent Exams)', () => {
    it('maintains separate sessions for different examSessionIds', fakeAsync(async () => {
      await service.init();

      const session1 = createFullTestState({
        examSessionId: 'exam-session-1',
        answers: { 1: 'A' },
      });
      const session2 = createFullTestState({
        examSessionId: 'exam-session-2',
        answers: { 1: 'B' },
      });

      await service.saveState(session1);
      tick(600);
      await service.saveState(session2);
      tick(600);
      await Promise.resolve();

      expect(await service.hasSession('exam-session-1')).toBe(true);
      expect(await service.hasSession('exam-session-2')).toBe(true);

      const loaded1 = await service.loadState('exam-session-1');
      const loaded2 = await service.loadState('exam-session-2');

      expect(loaded1!.answers[1]).toBe('A');
      expect(loaded2!.answers[1]).toBe('B');

      discardPeriodicTasks();
    }));

    it('clearing one session does not affect others', fakeAsync(async () => {
      await service.init();

      const session1 = createFullTestState({
        examSessionId: 'keep-session',
        answers: { 1: 'A' },
      });
      const session2 = createFullTestState({
        examSessionId: 'clear-session',
        answers: { 1: 'B' },
      });

      await service.saveState(session1);
      tick(600);
      await service.saveState(session2);
      tick(600);
      await Promise.resolve();

      await service.clearState('clear-session');

      expect(await service.hasSession('keep-session')).toBe(true);
      expect(await service.hasSession('clear-session')).toBe(false);

      const loaded = await service.loadState('keep-session');
      expect(loaded!.answers[1]).toBe('A');

      discardPeriodicTasks();
    }));
  });
});