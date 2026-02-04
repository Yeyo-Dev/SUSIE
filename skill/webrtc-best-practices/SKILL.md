---
name: WebRTC Best Practices
description: Guidelines for handling media devices, permissions, and streams.
---

# WebRTC & Media Capture Best Practices

## 1. Permissions & User Experience
-   **Proactive Permissioning:** Explain *why* you need the camera before requesting it.
-   **Handle Denials:** Gracefully handle `NotAllowedError`. Show instructions on how to unblock in browser settings.
-   **Secure Context:** `getUserMedia` ONLY works on HTTPS or localhost.

## 2. Resource Management
-   **Stop Tracks:** Always stop all tracks (`stream.getTracks().forEach(t => t.stop())`) when the component is destroyed or the session ends.
-   **Release Memory:** Set `videoElement.srcObject = null` after stopping.

## 3. Performance
-   **Constraints:** Request only the resolution you need (e.g., `{ width: { ideal: 1280 } }`).
-   **Canvas Optimization:** When taking snapshots, use 'image/jpeg' with quality < 0.9 to reduce payload size.
-   **Offscreen Processing:** For heavy processing, consider Web Workers (though for simple snapshots, main thread is usually fine).

## 4. Debugging
-   **browser://webrtc-internals:** Use Chrome's internal tool to debug streams.
-   **Video Element:** Always use `playsinline` (for iOS behavior) and `muted` (to avoid feedback loops) on local preview videos.
