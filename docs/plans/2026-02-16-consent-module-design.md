# Consent Module Design — ConsentDialogComponent

> Validated: 2026-02-16

## Decisions

- **Text source:** SUSIE auto-generates T&C text based on active security policies (`requireCamera`, `requireMicrophone`, `requireBiometrics`)
- **Rejection behavior:** Block exam but allow reconsideration (user can re-read and re-accept)
- **UI:** Full-screen step (not modal), checkbox + submit button
- **Location:** Inside `ngx-susie-proctoring` library, gated by `SusieWrapperComponent`

## Data Model

```typescript
interface ConsentResult {
  accepted: boolean;
  timestamp: string;
  permissionsConsented: ('camera' | 'microphone' | 'biometrics')[];
}
```

## Flow

1. `SusieWrapperComponent` checks if consent is needed (`requireCamera || requireMicrophone`)
2. Shows `ConsentDialogComponent` full-screen with dynamic text
3. User reads terms, checks checkbox, submits
4. If accepted → proceed to proctoring init
5. If rejected → show rejection screen with "Reconsider" button

## Production Standards

- No `standalone: true` (Angular v20+ default)
- `input()` / `output()` signals, not decorators
- `ChangeDetectionStrategy.OnPush`
- WCAG AA accessible (focus management, ARIA, keyboard nav)
- No `CommonModule`, no `ngClass`/`ngStyle`
