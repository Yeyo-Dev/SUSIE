---
name: AI Engineering Practices
description: Guidelines for Python-based AI services with YOLO/DeepFace.
---

# AI Engineering Best Practices

## 1. MLOps & Project Structure
-   **Modular Code:** No notebook dumps. Refactor logic into classes/functions in `src/`.
-   **Dependencies:** Use `pyproject.toml` or `requirements.txt` with pinned versions.
-   **Configuration:** Externalize config (model paths, thresholds) via `.env` or structured YAML/Hydra.

## 2. YOLO & DeepFace (Computer Vision)
-   **Inference:**
    -   Load models **once** at startup (Singleton pattern).
    -   Use `half=True` (FP16) on GPU for speed if available.
    -   Batch processing if realtime latency allows, otherwise minimal batch=1.
-   **Preprocessing:** Resize images to model input size (e.g., 640x640) *before* inference to save VRAM/Compute.
-   **Postprocessing:** Handle "Zero Detections" gracefully. Don't crash if no face is found.

## 3. API Integration
-   **Input:** Accept images as Base64 or FormData (Bytes).
-   **Output:** Return structured JSON with confidence scores and bounding boxes.
-   **Latency:** If processing takes >500ms, offload to a background worker (Celery/RabbitMQ) and return a Job ID.

## 4. Testing
-   **Unit Tests:** Test preprocessing logic and model loading.
-   **Integration Tests:** Test the full `Image -> Prediction -> JSON` pipeline.
-   **Benchmarks:** Measure FPS to ensure it meets requirements (e.g., >5 FPS for Proctoring).
