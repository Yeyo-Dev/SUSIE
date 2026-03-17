# Proposal: Gaze Precision Improvements

Reduce gaze tracking jitter by enhancing the signal processing pipeline across 4 layers.

## Scope

**In:** Kalman tuning, dynamic confidence weighting, outlier rejection, weighted average, regression model switch.
**Out:** Calibration flow, face detection, deviation thresholds.

---

## Approach (4 Layers)

### Layer 1: Regression Model
[ridge](file:///home/moarimikashi/Documents/SUSIE/frontend/projects/ngx-susie-proctoring/src/lib/services/gaze/webgazer-bridge.service.ts#16-169) → `weightedRidge` — gives more weight to recent calibration data, adapts to head drift.

### Layer 2: Kalman Tuning + Dynamic R
- Base params: `Q=0.1→0.02`, `R=0.4→0.8` (stronger smoothing)
- Dynamic R based on confidence: `effectiveR = baseR × (1.5 - confidence)`
  - High confidence → lower R → trust measurement
  - Low confidence → higher R → trust model (less jitter)

### Layer 3: Outlier Rejection
Discard frames where point jumps >30% of screen from previous estimate (blinks, reflections).

### Layer 4: Weighted Moving Average
Replace simple average with linear-weighted (newer = more weight). Reduces lag vs equal-weight.

---

## File Impact

| File | Change | Risk |
|------|--------|------|
| [kalman-filter.ts](file:///home/moarimikashi/Documents/SUSIE/frontend/projects/ngx-susie-proctoring/src/lib/utils/kalman-filter.ts) | Add optional `dynamicR` to [update()](file:///home/moarimikashi/Documents/SUSIE/frontend/projects/ngx-susie-proctoring/src/lib/utils/kalman-filter.ts#24-47) | Low |
| [signal-smoothing.service.ts](file:///home/moarimikashi/Documents/SUSIE/frontend/projects/ngx-susie-proctoring/src/lib/services/gaze/signal-smoothing.service.ts) | Tuned params, outlier removal, weighted avg | Medium |
| [webgazer-bridge.service.ts](file:///home/moarimikashi/Documents/SUSIE/frontend/projects/ngx-susie-proctoring/src/lib/services/gaze/webgazer-bridge.service.ts) | One-line regression swap | Low |
| [gaze-tracking.facade.ts](file:///home/moarimikashi/Documents/SUSIE/frontend/projects/ngx-susie-proctoring/src/lib/services/gaze/gaze-tracking.facade.ts) | Pass confidence to smoothing | Low |

## Trade-offs

| Gain | Cost |
|------|------|
| Smooth, stable gaze dot | ~50-100ms smoothing lag |
| No spike-induced false alarms | May miss ultra-fast glances (>30% screen/frame) |
| Better accuracy over time | Negligible CPU increase |

## Risks

1. **Over-smoothing** — fast intentional eye movements may feel laggy. Mitigated by 30% outlier threshold.
2. **Regression model change** — `weightedRidge` well-tested in WebGazer but new to SUSIE. Easy to revert.
