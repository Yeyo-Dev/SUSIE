# 📋 Tareas Pendientes — Vargas (AI Workers + Motor de Inferencia)

> Generado: 2026-03-03 | Basado en análisis del código actual del repositorio

---

## 🔴 Prioridad Alta (Sprint Actual)

### ~~SUSIE-AI-01: Acordar contrato de campos con backend~~
**Tipo:** Tarea | **Estado:** ✅ RESUELTO  
**Descripción:** Workers adaptados a los campos del backend: `user_id`, `sesion_id`, `url_storage`. Eventos de salida también usan `user_id`/`sesion_id`.

---

### SUSIE-AI-02: Implementar motor de inferencia bayesiano (`inference_engine/`)
**Tipo:** Feature | **Estimación:** 8h  
**Descripción:** El archivo `inference_engine/main.py` es un placeholder que consume de `ai_processing` (que no existe). Necesita implementarse con pgmpy:
- Definir la estructura de la Red Bayesiana (3 nodos observables → 1 nodo Fraude)
- Cargar la CPT de 64 combinaciones desde `CPT_Red_Bayesiana_64_Combinaciones.md`
- Consumir de `q_evidencias` y acumular distribuciones por sesión
- Ejecutar inferencia con las 3 distribuciones más recientes (Visión + Audio + Gaze)
- Publicar la probabilidad posterior P(Fraude) al backend (cola o API REST)

**Subtareas:**
- [ ] Modelar la red con `pgmpy.models.BayesianNetwork`
- [ ] Cargar/generar las CPTs programáticamente
- [ ] Consumir de `q_evidencias` (ya declarada por los workers)
- [ ] Implementar lógica de acumulación por sesión (ventana temporal)
- [ ] Definir formato de salida y canal de comunicación con backend
- [ ] Tests unitarios con distribuciones mock

---

### SUSIE-AI-03: Dockerizar motor de inferencia
**Tipo:** Tarea | **Estimación:** 2h  
**Descripción:** Crear `Dockerfile` para `inference_engine/`. Agregar servicio al `docker-compose.yml` (comentado como los otros workers). El `requirements.txt` actual ya lista `pgmpy` pero mezcla dependencias de otros workers (ultralytics, mediapipe, etc.) que deben limpiarse.

**Criterio de aceptación:**
- `requirements.txt` solo tiene: `pika`, `pgmpy`, `numpy`, `python-dotenv`
- `Dockerfile` funcional
- Servicio en `docker-compose.yml` comentado

---

## 🟡 Prioridad Media

### SUSIE-AI-04: Coordinar con backend la producción de mensajes en `q_gaze`
**Tipo:** Tarea | **Estimación:** 2h  
**Descripción:** El worker de gaze ahora consume de `q_gaze` (renombrada para consistencia con `q_snapshots`/`q_audios`). El backend necesita:
1. Declarar `q_gaze` en `rabbitmq.ts` con binding a `stream.gaze`
2. Crear un servicio que acumule coordenadas de WebGazer y las publique como `gaze_buffer` (≥ 15 coordenadas)ar con backend cuál opción se elige.

---

### SUSIE-AI-05: Subir imágenes/audios a Azure Blob Storage (en lugar de disco local)
**Tipo:** Feature | **Estimación:** 4h  
**Descripción:** El backend actualmente guarda archivos en disco local y genera una `mockUrl` simulada de Azure. Los workers descargan desde esa URL. Antes de desplegar a producción, el backend necesita subir realmente a Azure Blob. Nosotros debemos validar que nuestros workers descargan correctamente desde URLs reales de Azure.

**Criterio de aceptación:** Workers descargan de URLs `https://*.blob.core.windows.net/...` sin errores en staging.

---

### SUSIE-AI-06: Integrar API biométrica con flujo de registro/validación del backend
**Tipo:** Feature | **Estimación:** 2h  
**Descripción:** La API biométrica ahora es stateless con endpoints `/api/vectorize` y `/api/compare`. El backend necesita:
1. Llamar a `/api/vectorize` durante el registro y guardar el embedding en su BD
2. Llamar a `/api/compare` durante la validación, enviando el vector de la BD + la URL de la nueva imagen

Nosotros debemos estar disponibles para debugging durante la integración.

---

## 🟢 Prioridad Baja (Próximo Sprint)

### SUSIE-AI-07: Tests de integración E2E (workers → q_evidencias → inference engine)
**Tipo:** Testing | **Estimación:** 4h  
**Descripción:** Crear un script que simule el flujo completo:
1. Publicar mensajes mock en `q_snapshots`, `q_audios`, `gaze_tasks_queue`
2. Verificar que los workers producen soft evidence válida en `q_evidencias`
3. Verificar que el motor de inferencia calcula P(Fraude) correctamente
4. Validar con los 64 escenarios de la CPT

---

### SUSIE-AI-08: Dashborad de monitoreo de workers
**Tipo:** Mejora | **Estimación:** 3h  
**Descripción:** Agregar métricas de procesamiento (mensajes/min, latencia, errores) a los workers. Opciones: Prometheus + Grafana, o métricas simples en logs estructurados JSON que ya tienen los workers.

---

### SUSIE-AI-09: Configuración por variables de entorno
**Tipo:** Deuda técnica | **Estimación:** 2h  
**Descripción:** Varios valores están hardcodeados en los workers:
- Umbrales de YOLO (`CONF_THRESHOLD = 0.45`)
- Umbral semántico (`UMBRAL_ALERTA = 0.55`)
- Temperatura del softmax audio (`temperatura = 1.5`)
- Umbral de silencio (`-45dB`)
- Mínimo de buffer gaze (`15 frames`)

Moverlos a variables de entorno para poder ajustar sin redesplegar.

---

## Resumen

| Prioridad | Tareas | Horas estimadas |
|-----------|--------|----------------|
| 🔴 Alta | 3 | ~11h |
| 🟡 Media | 3 | ~9h |
| 🟢 Baja | 3 | ~9h |
| **Total** | **9** | **~29h** |
