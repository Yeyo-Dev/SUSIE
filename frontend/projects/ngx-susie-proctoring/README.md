# ngx-susie-proctoring

A comprehensive Angular library for remote proctoring with advanced monitoring, security, and accessibility features.

---

## Features

- 📹 **Real-time Camera Monitoring**: Picture-in-picture camera feed with status indicators
- 🛡️ **Security Detection**: Detects tab switches, fullscreen exits, focus loss, inspection attempts
- 👀 **Eye Gaze Tracking** (optional): Uses WebGazer for attention monitoring
- 🔐 **Biometric Verification**: Identity verification via face detection
- 🎤 **Audio/Microphone Monitoring**: Optional microphone access for proctoring
- ♿ **Accessibility First**: WCAG 2.1 AA compliant interface
- 🔄 **Network Resilience**: Automatic reconnection with exponential backoff
- 📊 **Violation Reporting**: Detailed logs of security violations
- ⚡ **Zero-leak Architecture**: Automatic cleanup of timers, listeners, and subscriptions
- 🎯 **Fully Typed**: 100% TypeScript with zero `any` types

---

## Quick Start

### 1. Installation

```bash
npm install ngx-susie-proctoring
```

### 2. Basic Usage

```typescript
import { SusieWrapperComponent } from 'ngx-susie-proctoring';
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SusieWrapperComponent],
  template: `
    <susie-wrapper [config]="susieConfig">
      <p>Your exam content here</p>
    </susie-wrapper>
  `,
})
export class AppComponent {
  susieConfig = {
    sessionContext: {
      examSessionId: 'sess-123',
      examId: 'exam-456',
      examTitle: 'Math Final',
    },
    proctoring: {
      enableCamera: true,
      enableMicrophone: false,
      enableGazeTracking: false,
    },
  };
}
```

### 3. Handle Violations

```typescript
export class AppComponent {
  onViolation(violation: SecurityViolation) {
    console.log(`Security violation detected: ${violation.type}`);
    // Send to backend
    // Consider ending the exam
  }
}
```

---

## Documentation

### 🧹 [Cleanup Policy](./docs/CLEANUP-POLICY.md)

**Read this first.** Explains how SUSIE prevents memory leaks:
- Using `DestroyRefUtility` for timers and event listeners
- Automatic cleanup in `ngOnDestroy`
- Patterns for RxJS subscriptions with `takeUntilDestroyed()`
- Anti-patterns to avoid
- Code review checklist for cleanup

**Key Takeaway**: All timers, listeners, and subscriptions must be cleaned up automatically. Use `DestroyRefUtility`.

### 📝 [Typing Guide](./docs/TYPING-GUIDE.md)

**Read this before writing code.** Explains SUSIE's strict typing:
- Why `any` is forbidden
- How to use interfaces in `contracts.ts`
- Patterns for functions, signals, observables, and HTTP calls
- Creating new interfaces safely
- Common typing gotchas

**Key Takeaway**: Every function, signal, and observable must have explicit types. No `any`.

### ✅ [Code Review Checklist](./docs/CODE-REVIEW-CHECKLIST.md)

**Use this when reviewing PRs.** A comprehensive checklist for:
- Cleanup verification (timers, listeners, subscriptions)
- Type safety (no `any`, proper interfaces)
- Visibility and encapsulation
- Test coverage
- Documentation
- Architecture patterns

**Key Takeaway**: Zero tolerance for memory leaks and `any` types.

---

## Architecture

### Project Structure

```
src/
├── lib/
│   ├── components/           # Standalone components
│   │   ├── camera-pip/      # Picture-in-picture camera
│   │   ├── consent-dialog/  # Consent flow
│   │   ├── exam-engine/     # Question/answer interface
│   │   └── susie-wrapper/   # Main wrapper component
│   │
│   ├── services/            # Core services
│   │   ├── network-monitor.service.ts      # Network status
│   │   ├── security.service.ts             # Violation detection
│   │   ├── webgazer.service.ts             # Eye tracking
│   │   ├── exam.service.ts                 # Exam state
│   │   └── logger.service.ts               # Centralized logging
│   │
│   ├── utils/               # Utilities
│   │   ├── destroy-ref.utility.ts          # Cleanup management
│   │   └── destroy-ref.utility.spec.ts
│   │
│   ├── models/
│   │   ├── contracts.ts     # Type definitions (THE SOURCE OF TRUTH FOR TYPES)
│   │   └── contracts.type-tests.ts
│   │
│   └── public-api.ts        # Library exports
│
├── docs/
│   ├── CLEANUP-POLICY.md    # Memory leak prevention
│   ├── TYPING-GUIDE.md      # Type safety standards
│   └── CODE-REVIEW-CHECKLIST.md
```

### Design Principles

1. **Standalone Components**: All components are standalone, no shared modules
2. **Signal-based State**: Uses Angular signals for reactive state management
3. **Automatic Cleanup**: `DestroyRefUtility` centralizes resource cleanup
4. **Zero Leaks**: Every timer, listener, and subscription is tracked and cleaned
5. **Strict Types**: 100% TypeScript, zero `any` types, all data structures in `contracts.ts`
6. **Accessibility First**: WCAG 2.1 AA compliance from the start

---

## Key Concepts

### DestroyRefUtility

Centralized cleanup for timers, listeners, and subscriptions:

```typescript
// In a service:
private cleanup = inject(DestroyRefUtility);

// Automatic cleanup in constructor:
this.cleanup.setInterval(() => checkStatus(), 5000);
this.cleanup.addEventListener(window, 'resize', this.onResize);
```

See [Cleanup Policy](./docs/CLEANUP-POLICY.md) for details.

### Contracts.ts

All data structures are defined in `src/lib/models/contracts.ts`:

```typescript
export interface SecurityViolation {
  type: 'TAB_SWITCH' | 'FOCUS_LOST' | /* ... */;
  message: string;
  timestamp: string;
}
```

See [Typing Guide](./docs/TYPING-GUIDE.md) for how to use and extend types.

### Component Inputs

All components use Angular's modern `input()` API:

```typescript
export class MyComponent {
  violation = input.required<SecurityViolation>();
  isVisible = input(true);
}
```

---

## Development

### Prerequisites

- Node.js 18+
- Angular 18+
- TypeScript 5.2+

### Setup

```bash
# Clone the repo
git clone https://github.com/...

# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm run test
```

### Build & Testing

```bash
# Build library
npm run build:lib

# Run unit tests
npm run test

# Run integration tests
npm run test:integration
```

---

## Code Review Standards

**All contributions must follow these standards:**

1. ✅ **No memory leaks**: Use `DestroyRefUtility` for timers/listeners
2. ✅ **No `any` types**: All data must be typed in `contracts.ts`
3. ✅ **Test coverage**: New features must have tests
4. ✅ **Documentation**: Complex logic must be documented

See [Code Review Checklist](./docs/CODE-REVIEW-CHECKLIST.md) for details.

---

## Contributing

### For New Features

1. Read [Cleanup Policy](./docs/CLEANUP-POLICY.md) and [Typing Guide](./docs/TYPING-GUIDE.md)
2. Follow the patterns in existing code
3. Add types to `contracts.ts` if introducing new data structures
4. Use `DestroyRefUtility` for any timers/listeners
5. Add unit tests
6. Request review using [Code Review Checklist](./docs/CODE-REVIEW-CHECKLIST.md)

### For Bug Fixes

1. Write a test that reproduces the bug
2. Fix the bug
3. Verify tests pass
4. Request review

---

## License

[Your License Here]

---

## Support

For questions or issues:
- Check the docs: [Cleanup Policy](./docs/CLEANUP-POLICY.md), [Typing Guide](./docs/TYPING-GUIDE.md)
- Open an issue on GitHub
- Review existing code in `src/lib/` for examples

---

## Onboarding Checklist

If you're new to ngx-susie-proctoring:

- [ ] Read [Cleanup Policy](./docs/CLEANUP-POLICY.md) — understand memory leak prevention
- [ ] Read [Typing Guide](./docs/TYPING-GUIDE.md) — understand type requirements
- [ ] Explore `src/lib/models/contracts.ts` — see all data structures
- [ ] Review `src/lib/components/` — study existing component patterns
- [ ] Review `src/lib/services/` — study existing service patterns
- [ ] Check `src/lib/utils/destroy-ref.utility.ts` — understand cleanup utility
- [ ] Read [Code Review Checklist](./docs/CODE-REVIEW-CHECKLIST.md) — before submitting PRs

**Don't skip the docs!** They exist to prevent common mistakes and save you time.
