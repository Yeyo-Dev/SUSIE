---
name: Angular 17+ Best Practices
description: Guidelines for modern Angular development using Standalone components and Signals.
---

# Angular 17+ Best Practices

## 1. Architecture: Standalone First
-   **No NgModules:** All components, directives, and pipes must be `standalone: true`.
-   **Lazy Loading:** Load routes directly using `loadComponent`.
-   **Bootstrap:** Use `bootstrapApplication` in `main.ts`.

## 2. State Management: Signals
-   **Use Signals:** Prefer `signal()`, `computed()`, and `effect()` over `BehaviorSubject` for local synchronous state.
-   **Inputs:** Use `input()` and `input.required()` signal-based inputs.
-   **Outputs:** Use `output()` instead of `@Output` decorator (if available in version) or standard `EventEmitter`.

## 3. Control Flow
-   **New Syntax:** Use `@if`, `@for`, `@switch` in templates. Avoid `*ngIf` and `*ngFor`.
    ```html
    @if (loading()) {
      <spinner />
    } @else {
      <content />
    }
    ```

## 4. Performance
-   **OnPush:** Always use `ChangeDetectionStrategy.OnPush`.
-   **Defer:** Use `@defer` blocks for heavy components that are below the fold or optional.

## 5. Security
-   **Sanitization:** Trust no generic content. Use Angular's built-in sanitization.
-   **CSP:** Ensure styles and scripts comply with CSP policies.
