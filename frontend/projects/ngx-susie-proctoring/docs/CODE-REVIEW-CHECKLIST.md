# Code Review Checklist - SUSIE Proctoring

Use this checklist when reviewing PRs for ngx-susie-proctoring. All items must pass before approval.

---

## 🧹 Cleanup Policy

Resource leaks are the #1 cause of performance degradation in SUSIE. Check ruthlessly.

### Timers & Intervals

- [ ] Does the PR use `setInterval()` or `setTimeout()` without `cleanup.*`?
  - If yes → REJECT. Must use `cleanup.setInterval()` or `cleanup.setTimeout()`
  
- [ ] Are timers registered with `DestroyRefUtility`?
  - Look for: `private cleanup = inject(DestroyRefUtility);`
  - Look for: `this.cleanup.setInterval(...)` or `this.cleanup.setTimeout(...)`

- [ ] If timers are cancelled manually, does code use `cleanup.clearInterval()` or `cleanup.clearTimeout()`?
  - Check the interval/timeout ID is actually cleared

### Event Listeners

- [ ] Does the PR use `addEventListener()` without `cleanup.addEventListener()`?
  - If yes → REJECT. Must use `cleanup.addEventListener()`

- [ ] Are handlers arrow functions or stable method references?
  - ❌ Bad: `window.addEventListener('resize', this.handleResize)` where `handleResize` is a method
  - ✅ Good: `this.cleanup.addEventListener(window, 'resize', this.handleResize)` where `handleResize` is an arrow function

- [ ] If listeners are removed manually, are they using `cleanup.removeEventListener()`?

### RxJS Subscriptions

- [ ] Do subscriptions use `takeUntilDestroyed()` or similar unsubscribe pattern?
  - ❌ Bad: `observable$.subscribe(...)`
  - ✅ Good: `observable$.pipe(takeUntilDestroyed(cleanup.ref)).subscribe(...)`

- [ ] Are subscriptions stored in a variable if they're manually cancelled?
  - If stored, verify the unsubscribe happens in `ngOnDestroy` or equivalent

### Service-level Cleanup

- [ ] Does the service inject `DestroyRefUtility` if it has ANY timers/listeners?
  - Example: `private cleanup = inject(DestroyRefUtility);`

- [ ] Is there an explicit `ngOnDestroy` with manual cleanup for edge cases?
  - For most cases, cleanup is automatic. Manual cleanup is only needed for special cases.

---

## 🔤 Typing

**ZERO TOLERANCE**: `any` type is forbidden. Every piece of data must be typed.

### No `any` Types

- [ ] Search for `any` in the PR diff. Results?
  - If yes → REJECT with comment: "Please remove `any`. Use or create an interface in contracts.ts"

- [ ] Check function parameters are typed:
  - ❌ Bad: `function processData(data) { ... }`
  - ✅ Good: `function processData(data: SecurityViolation): void { ... }`

- [ ] Check function return types are explicit:
  - ❌ Bad: `function getData() { ... }`
  - ✅ Good: `function getData(): ExamResult { ... }`

### Interfaces & Contracts

- [ ] Are new data structures defined in `src/lib/models/contracts.ts`?
  - If introducing new data structure not in contracts.ts → REJECT

- [ ] Are existing interfaces from `contracts.ts` being reused?
  - Approved interfaces: `SecurityViolation`, `ExamResult`, `ConsentResult`, `SusieQuestion`, `BackendEvaluacionResponse`, etc.

- [ ] If a new interface is needed, is it documented with JSDoc comments?
  ```typescript
  /**
   * Description of what this interface represents.
   * When to use it.
   */
  export interface NewType { ... }
  ```

### Angular-specific Typing

- [ ] Are Signal types explicit?
  - ❌ Bad: `signal([])`
  - ✅ Good: `signal<SecurityViolation[]>([])`

- [ ] Are Observable types explicit?
  - ❌ Bad: `data$: Observable;`
  - ✅ Good: `data$: Observable<ExamResult>;`

- [ ] Are Component inputs typed?
  - ❌ Bad: `violation = input();`
  - ✅ Good: `violation = input.required<SecurityViolation>();`

- [ ] Are HTTP calls typed?
  - ❌ Bad: `this.http.get('/api/exams/123')`
  - ✅ Good: `this.http.get<BackendExamenResponse>('/api/exams/123')`

---

## 👁️ Visibility & Encapsulation

Prevent accidental API surface changes.

- [ ] Are class members marked `private`, `protected`, or `public` explicitly?
  - Missing visibility → COMMENT: "Add explicit visibility (private/public/protected)"

- [ ] Are readonly properties used where values shouldn't change?
  - Example: `private readonly cleanup = inject(DestroyRefUtility);`

- [ ] Are service properties that should be read-only exposed as signals?
  - ✅ Good: `violations$ = this.violations.asReadonly();`

- [ ] Are public methods actually needed, or should they be private?
  - COMMENT if method is public but only used internally

---

## 🧪 Tests

Coverage must be present for critical paths.

- [ ] Does the PR include `.spec.ts` files for new services/components?
  - If new logic added without tests → REQUEST: "Please add unit tests"

- [ ] Do tests cover happy path + error cases?
  - Tests should verify what happens when things fail, not just when they succeed

- [ ] Are mocks properly typed?
  - Look for `jasmine.createSpyObj<Type>(...)`
  - ❌ Bad: `jasmine.createSpyObj('service', ['method'])`
  - ✅ Good: `jasmine.createSpyObj<MyService>('service', ['method'])`

- [ ] Do tests verify cleanup happens?
  - For services with timers/listeners, test that they're cleaned up in `ngOnDestroy`

---

## 📋 Documentation

Code should explain why, not just what.

- [ ] Are complex functions documented with JSDoc comments?
  - Example: Functions with cleanup, special handling, or non-obvious behavior

- [ ] Are private methods documented if they're called from multiple places?

- [ ] Are magic numbers/strings explained?
  - ❌ Bad: `const MAX_RETRIES = 3; // What's this for?`
  - ✅ Good: `const MAX_API_RETRIES = 3; // Retry failed API calls up to 3 times`

---

## 🏗️ Architecture & Patterns

Maintain consistency with SUSIE's architecture.

### Service Injection & Dependency Injection

- [ ] Are dependencies properly injected using `inject()`?
  - ✅ Good: `private logger = inject(Logger);`
  - ❌ Bad: Old constructor-based DI style

- [ ] Are `DestroyRefUtility` and `Logger` available where needed?
  - If service needs cleanup, it should inject `DestroyRefUtility`

### Signals & Reactivity

- [ ] Are signals used instead of BehaviorSubject for component state?
  - Signals are preferred in SUSIE (Angular 17+)

- [ ] If using signals, are computed() used for derived state?
  - ❌ Bad: Multiple signals updated together
  - ✅ Good: `computed(() => this.signal1() + this.signal2())`

### Component Structure

- [ ] Are components standalone?
  - SUSIE uses standalone components. If not standalone, REQUEST: "Please make this standalone"

- [ ] Are template bindings type-safe?
  - Uses property binding instead of string templates where possible

---

## 🔍 Common Issues to Check

### Memory Leaks

- [ ] **Global event listeners without cleanup**: `window.addEventListener()` without cleanup
- [ ] **Timers that never stop**: `setInterval()` without being cleared
- [ ] **Subscriptions not unsubscribed**: Observable subscriptions without `takeUntilDestroyed()`

### Type Issues

- [ ] **Implicit `any`**: Parameters or variables without explicit types
- [ ] **Mismatched types**: Passing `SecurityViolation` to function expecting `ExamResult`
- [ ] **Null checks missing**: Not checking for undefined/null before accessing properties

### Performance

- [ ] **Change detection issues**: Components trigger unnecessary change detection
- [ ] **Inefficient queries**: DOM queries in loops or frequently-called functions
- [ ] **Unoptimized observables**: Creating new observables on each render

### Testing

- [ ] **Incomplete test coverage**: New logic without corresponding tests
- [ ] **Tests that don't actually test**: Tests that pass regardless of implementation
- [ ] **Flaky tests**: Tests that sometimes pass, sometimes fail

---

## ✅ Quick Approval Checklist

Before clicking "Approve":

- [ ] No `any` types
- [ ] All timers/listeners use cleanup utility
- [ ] All new types in contracts.ts
- [ ] All functions have explicit types
- [ ] Tests included for new logic
- [ ] Documentation for non-obvious code
- [ ] Visibility modifiers on all class members
- [ ] No global event listeners without cleanup

---

## 📝 Comment Templates

### For `any` types:

```
Please remove `any` and use a proper interface. 
Create the interface in `src/lib/models/contracts.ts` if it doesn't exist.
See TYPING-GUIDE.md for examples.
```

### For missing cleanup:

```
This timer/listener needs cleanup. Use `DestroyRefUtility`:
1. Inject: `private cleanup = inject(DestroyRefUtility);`
2. Replace: `setInterval(...)` → `this.cleanup.setInterval(...)`

See CLEANUP-POLICY.md for details.
```

### For missing visibility modifiers:

```
Please add explicit visibility (private/public/protected) to class members.
Default private is preferred unless the member is part of the public API.
```

### For missing tests:

```
Please add a `.spec.ts` file covering:
- Happy path
- Error cases
- Cleanup verification (if applicable)

See existing tests in the project for patterns.
```

---

## Reference

- **Cleanup Policy**: `/docs/CLEANUP-POLICY.md`
- **Typing Guide**: `/docs/TYPING-GUIDE.md`
- **Contracts**: `src/lib/models/contracts.ts`
- **Utilities**: `src/lib/utils/destroy-ref.utility.ts`

---

## Notes for Reviewers

- Be **strict** on memory leaks — they compound over time
- Be **strict** on typing — `any` defeats the entire purpose of TypeScript
- Be **helpful** in comments — link to docs and provide examples
- Be **consistent** — apply the same standards to all PRs

**When in doubt, ask the author to review the relevant doc.**
