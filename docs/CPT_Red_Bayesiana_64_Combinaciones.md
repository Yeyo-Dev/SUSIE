# Tabla de Probabilidad Condicional Completa (CPT) — Red Bayesiana de Proctoring

> **P(Fraude | Visión, Audio, Mirada)** — 64 combinaciones exhaustivas para los 3 nodos observables.

---

## Variables del Modelo

| Nodo | Estados |
|---|---|
| **Visión (V)** | `Normal` · `Ausente` · `Objeto_Prohibido` · `Multitud` |
| **Audio (A)** | `Silencio` · `Neutral` · `Doméstico` · `Sospechoso` |
| **Mirada (G)** | `Concentrado` · `Fuera_de_Pantalla` · `Atención_Secundaria` · `Errático` |

---

## Grupo 1 — Visión: `Objeto_Prohibido` (Celular Detectado)

> **Filosofía: Evidencia fuerte, pero no infalible.** YOLOv8 reporta una precisión del ~95% en la clase `cellphone`, lo que implica que **1 de cada 20 detecciones puede ser un falso positivo** (ej. un control remoto, una calculadora autorizada, un estuche de lentes). Si tratáramos esta señal como determinista, la Red Bayesiana sería redundante — un simple `if` bastaría. Los nodos de Audio y Mirada existen precisamente para modular esta incertidumbre: corroborar el fraude cuando las señales convergen, o **atenuar** cuando el contexto sugiere un falso positivo del modelo.

### Modelo Paramétrico Aditivo

Los valores de este grupo se calculan con la siguiente fórmula lineal acotada:

$$P(\text{Fraude}) = \min\Big(P_{\text{base}}(V) + \Delta_A + \Delta_G,\; 0.99\Big)$$

Donde:

| Parámetro | Valor | Justificación |
|---|---|---|
| $P_{\text{base}}$ (YOLO `Objeto_Prohibido`) | **0.85** | Precisión de YOLO (~95%) penalizada por el umbral bajo de confianza (>45%) y por condiciones adversas comunes en webcams domésticas (iluminación, resolución, ángulo). |
| $\Delta_A$ (`Sospechoso`) | **+0.10** | Audio corrobora: lenguaje de trampa + celular = convergencia fuerte. |
| $\Delta_A$ (`Neutral`) | **+0.00** | Sin información útil desde el audio. |
| $\Delta_A$ (`Silencio`) | **−0.02** | Silencio total es la norma en un examen. No atenúa mucho, pero un tramposo con celular probablemente hablaría alguien. |
| $\Delta_A$ (`Doméstico`) | **−0.15** | **Atenuante significativo.** Si el NLP clasifica "doméstico", existe una probabilidad real de que el "celular" sea el teléfono de un familiar visible en cámara, o un objeto doméstico mal clasificado por YOLO. |
| $\Delta_G$ (`Errático`) | **+0.07** | Nerviosismo corrobora la sospecha y descarta coincidencia accidental. |
| $\Delta_G$ (`Fuera_de_Pantalla`) | **+0.05** | Mira fuera: posible consulta al dispositivo detectado. |
| $\Delta_G$ (`Atención_Secundaria`) | **+0.04** | Isla periférica: atención dividida hacia una zona, coherente con uso de dispositivo. |
| $\Delta_G$ (`Concentrado`) | **−0.10** | **Atenuante clave.** Si la mirada está fija en la pantalla del examen, el estudiante NO está interactuando con el objeto detectado. Sugiere un falso positivo de YOLO o un celular que está sobre la mesa sin ser usado. |

### Tabla Resultante

| # | Visión | Audio | Mirada | Fórmula | P(Fraude) | Justificación |
|---|---|---|---|---|---|---|
| 1 | Objeto_Prohibido | Silencio | Concentrado | 0.85 − 0.02 − 0.10 | **73%** | Celular detectado pero el estudiante está callado y mirando la pantalla. Escenario compatible con un falso positivo de YOLO (calculadora, estuche) o un celular olvidado sobre la mesa. |
| 2 | Objeto_Prohibido | Silencio | Fuera_de_Pantalla | 0.85 − 0.02 + 0.05 | **88%** | Celular + desvío visual prolongado. El silencio no descarta que esté leyendo algo en el dispositivo. |
| 3 | Objeto_Prohibido | Silencio | Atención_Secundaria | 0.85 − 0.02 + 0.04 | **87%** | Celular + isla periférica = probablemente consultando el dispositivo en una zona específica. |
| 4 | Objeto_Prohibido | Silencio | Errático | 0.85 − 0.02 + 0.07 | **90%** | Celular + nerviosismo = sabe que está haciendo trampa e intenta disimular. |
| 5 | Objeto_Prohibido | Neutral | Concentrado | 0.85 + 0.00 − 0.10 | **75%** | Similar a #1. Audio neutro no aporta ni atenúa. La mirada concentrada sigue sugiriendo no-uso del objeto. |
| 6 | Objeto_Prohibido | Neutral | Fuera_de_Pantalla | 0.85 + 0.00 + 0.05 | **90%** | Celular + desvío visual sin explicación por audio. |
| 7 | Objeto_Prohibido | Neutral | Atención_Secundaria | 0.85 + 0.00 + 0.04 | **89%** | Celular + atención dividida. |
| 8 | Objeto_Prohibido | Neutral | Errático | 0.85 + 0.00 + 0.07 | **92%** | Celular + nerviosismo. Los dos sensores independientes (visual y conductual) corroboran. |
| 9 | Objeto_Prohibido | Doméstico | Concentrado | 0.85 − 0.15 − 0.10 | **60%** | **Mínimo del grupo.** Celular detectado, pero el audio es doméstico y la mirada está en pantalla. Escenario más probable: el teléfono de un familiar quedó visible en cámara, o YOLO clasificó un objeto doméstico como celular. Aún >50% porque el objeto *fue* detectado. |
| 10 | Objeto_Prohibido | Doméstico | Fuera_de_Pantalla | 0.85 − 0.15 + 0.05 | **75%** | Audio doméstico atenúa, pero el desvío visual compensa: quizá aprovecha la interrupción doméstica para consultar el celular. |
| 11 | Objeto_Prohibido | Doméstico | Atención_Secundaria | 0.85 − 0.15 + 0.04 | **74%** | Similar a #10. Atención periférica es ligeramente menos sospechosa que un desvío completo. |
| 12 | Objeto_Prohibido | Doméstico | Errático | 0.85 − 0.15 + 0.07 | **77%** | Doméstico atenúa pero el nerviosismo es contradictorio: ¿por qué estar nervioso si solo fue una interrupción de un familiar? |
| 13 | Objeto_Prohibido | Sospechoso | Concentrado | 0.85 + 0.10 − 0.10 | **85%** | Celular + voz sospechosa pero mirada en pantalla. Posible dictado recibido por auricular (mira pantalla mientras le dictan). |
| 14 | Objeto_Prohibido | Sospechoso | Fuera_de_Pantalla | 0.85 + 0.10 + 0.05 | **99%** | Triple convergencia: celular + lenguaje de trampa + desvío visual. Todos los sensores apuntan a lo mismo. |
| 15 | Objeto_Prohibido | Sospechoso | Atención_Secundaria | 0.85 + 0.10 + 0.04 | **99%** | Triple convergencia con foco periférico sostenido. |
| 16 | Objeto_Prohibido | Sospechoso | Errático | 0.85 + 0.10 + 0.07 | **99%** | **Máximo absoluto.** Celular + voz sospechosa + nerviosismo. Cap a 99% por principio bayesiano. |

---

## Grupo 2 — Visión: `Multitud` (Múltiples Personas)

> **Política: Alta sospecha.** La presencia de más de una persona en el encuadre sugiere asistencia no autorizada. Sin embargo, a diferencia del celular, existe un rango de atenuación: un familiar podría pasar brevemente detrás del estudiante. El Audio y la Mirada modulan la certeza entre 78% y 95%.

| # | Visión | Audio | Mirada | P(Fraude) | Justificación |
|---|---|---|---|---|---|
| 17 | Multitud | Silencio | Concentrado | **82%** | Alguien más en cámara pero hay silencio total y el estudiante está concentrado. Posible persona pasando de fondo. |
| 18 | Multitud | Silencio | Fuera_de_Pantalla | **88%** | Otra persona + el estudiante mira hacia ella = interacción implícita. |
| 19 | Multitud | Silencio | Atención_Secundaria | **87%** | Otra persona + foco dividido = posible lectura asistida. |
| 20 | Multitud | Silencio | Errático | **89%** | Otra persona + nerviosismo = consciente de la infracción. |
| 21 | Multitud | Neutral | Concentrado | **83%** | Similar al silencio. Ruido de fondo no aporta evidencia. |
| 22 | Multitud | Neutral | Fuera_de_Pantalla | **88%** | Otra persona + desvío visual. |
| 23 | Multitud | Neutral | Atención_Secundaria | **87%** | Otra persona + atención dividida. |
| 24 | Multitud | Neutral | Errático | **90%** | Otra persona + nerviosismo + ruido ambiental. |
| 25 | Multitud | Doméstico | Concentrado | **78%** | **Mínimo del grupo.** Otra persona + "mamá, cierra la puerta" + mirada en pantalla = familiar cruzando la habitación. El NLP doméstico atenúa considerablemente. |
| 26 | Multitud | Doméstico | Fuera_de_Pantalla | **80%** | Voltea a hablar con el familiar, pero la presencia de otro sigue siendo sospechosa. |
| 27 | Multitud | Doméstico | Atención_Secundaria | **80%** | Interacción con familiar visible. |
| 28 | Multitud | Doméstico | Errático | **85%** | Doméstico atenúa pero el nerviosismo lo compensa parcialmente. |
| 29 | Multitud | Sospechoso | Concentrado | **92%** | Otra persona + dictado/solicitud de respuestas + mirada en pantalla = le están dictando. |
| 30 | Multitud | Sospechoso | Fuera_de_Pantalla | **94%** | Otra persona + voz sospechosa + mira hacia ella = comunicación directa. |
| 31 | Multitud | Sospechoso | Atención_Secundaria | **93%** | Triple convergencia con fuente periférica. |
| 32 | Multitud | Sospechoso | Errático | **95%** | **Máximo del grupo.** Tercero dictando + nerviosismo total. |

---

## Grupo 3 — Visión: `Normal` (Estudiante Solo, Sin Objetos)

> **Zona de máxima sensibilidad del modelo.** Sin evidencia visual directa de trampa, la Red Bayesiana depende completamente de la fusión Audio↔Mirada. Aquí es donde los falsos positivos de sistemas rígidos (`if/else`) se vuelven más dañinos, y donde las probabilidades condicionales cruzadas demuestran su valor.

| # | Visión | Audio | Mirada | P(Fraude) | Justificación |
|---|---|---|---|---|---|
| 33 | Normal | Silencio | Concentrado | **1%** | **Caso ideal.** Solo, callado, mirando la pantalla. Probabilidad residual bayesiana (nunca 0%). |
| 34 | Normal | Silencio | Fuera_de_Pantalla | **20%** | Mira fuera de pantalla >1.5s en silencio. Podría estar pensando, estirándose, o consultando un papel. Ambiguo sin audio que lo corrobore. |
| 35 | Normal | Silencio | Atención_Secundaria | **28%** | DBSCAN detecta una isla periférica en silencio. Preocupante: podría leer notas físicas sin necesidad de hablar. Mayor que #34 porque la atención es sostenida, no momentánea. |
| 36 | Normal | Silencio | Errático | **45%** | Nerviosismo visual marcado sin audio. Sospechoso pero inconcluso: puede ser ansiedad del examen. Isolation Forest aporta incertidumbre, no certeza. |
| 37 | Normal | Neutral | Concentrado | **2%** | Casi ideal. Ruido ininteligible no aporta evidencia. Ligeramente > caso silencio porque *algo* de sonido existe. |
| 38 | Normal | Neutral | Fuera_de_Pantalla | **18%** | Mira fuera con ruido de fondo no clasificable. Similar a #34 pero el ruido neutral sugiere que el entorno no es perfectamente controlado (sin ser sospechoso). |
| 39 | Normal | Neutral | Atención_Secundaria | **25%** | Isla periférica + ruido no clasificable. |
| 40 | Normal | Neutral | Errático | **40%** | Nerviosismo + ruido ambiental difuso. Similar a #36 pero ligeramente menor porque el ruido neutral no correlaciona con trampa verbal. |
| 41 | Normal | Doméstico | Concentrado | **2%** | "Mamá, cierra la puerta" + mirada en pantalla = interrumpido brevemente por su entorno. Sin señal de deshonestidad. |
| 42 | Normal | Doméstico | Fuera_de_Pantalla | **15%** | **Atenuante clave.** Voltea a la puerta para hablar con un familiar. El NLP lo clasifica como doméstico, salvando al estudiante de un falso positivo temporal que el tracker de mirada habría disparado solo. |
| 43 | Normal | Doméstico | Atención_Secundaria | **12%** | Audio doméstico + atención secundaria = probablemente mira la fuente del ruido doméstico (TV, persona entrando). La sinergia Audio↔Gaze produce atenuación. |
| 44 | Normal | Doméstico | Errático | **20%** | Audio doméstico atenúa pero el nerviosismo es inusual si solo fue una interrupción familiar. Ligeramente sospechoso. |
| 45 | Normal | Sospechoso | Concentrado | **25%** | **Caso crítico: "Pensar en voz alta."** El NLP detecta lenguaje técnico (parece trampa), pero la mirada está fija en la pantalla. La red infiere que el estudiante lee el examen en voz alta o razona verbalmente. La sinergia Audio↔Gaze *reduce* la probabilidad de 92% a 25%. |
| 46 | Normal | Sospechoso | Fuera_de_Pantalla | **75%** | Audio sospechoso + mira fuera = probablemente comunicándose con alguien fuera del encuadre. El desvío visual corrobora la intención del audio. Alto pero no máximo porque YOLO no detecta a la otra persona. |
| 47 | Normal | Sospechoso | Atención_Secundaria | **80%** | Audio sospechoso + isla periférica sostenida = posiblemente leyendo en voz alta desde notas físicas o dictando a un dispositivo no detectado por YOLO. Mayor que #46 porque la atención es focalizada, no momentánea. |
| 48 | Normal | Sospechoso | Errático | **92%** | **Sinergia máxima Audio↔Gaze.** Nerviosismo visual (Isolation Forest) coordinado con lenguaje sospechoso. La probabilidad se dispara porque ambos sensores independientes (uno mide comportamiento visual, otro semántica verbal) coinciden en señalar deshonestidad. |

---

## Grupo 4 — Visión: `Ausente` (0 Personas en Encuadre)

> **Zona de incertidumbre inherente.** Cuando YOLO no detecta a nadie, los datos de Gaze Tracking pierden fiabilidad (si no hay rostro, el tracker puede dar coordenadas erróneas). Sin embargo, el **Audio se vuelve el sensor dominante**: si hay voz sospechosa sin persona visible, la inferencia más probable es que el estudiante se ocultó deliberadamente.

> [!NOTE]
> Cuando Visión = `Ausente`, la Mirada se marca como **degradada**. Sus valores influyen marginalmente (±3-5%) porque la fuente de datos (WebGazer) pierde el tracking facial. Las variaciones entre estados de Gaze reflejan datos residuales capturados antes o durante la desaparición del usuario.

| # | Visión | Audio | Mirada | P(Fraude) | Justificación |
|---|---|---|---|---|---|
| 49 | Ausente | Silencio | Concentrado | **45%** | Desapareció del encuadre en silencio. El gaze "concentrado" residual sugiere que se fue gradualmente (bajó la silla, se inclinó). Podría ser un corte de cámara, caída involuntaria o ida al baño. |
| 50 | Ausente | Silencio | Fuera_de_Pantalla | **52%** | La mirada salió de pantalla antes de perder tracking = se volteó deliberadamente. Silencio no confirma ni descarta nada. |
| 51 | Ausente | Silencio | Atención_Secundaria | **50%** | Atención periférica residual + ausencia + silencio = ambiguedad máxima. |
| 52 | Ausente | Silencio | Errático | **55%** | Nerviosismo residual antes de desaparecer sugiere intención, no accidente. |
| 53 | Ausente | Neutral | Concentrado | **47%** | Ruido de fondo + ausencia. Similar al silencio; el audio neutral no discrimina. |
| 54 | Ausente | Neutral | Fuera_de_Pantalla | **52%** | Igual que #50 con ruido irrelevante. |
| 55 | Ausente | Neutral | Atención_Secundaria | **50%** | Ambiguedad similar a #51. |
| 56 | Ausente | Neutral | Errático | **55%** | La misma lógica que #52. |
| 57 | Ausente | Doméstico | Concentrado | **35%** | **Atenuante fuerte.** "Ya voy mamá" + desaparece del frame = fue llamado por un familiar. Escenario doméstico legítimo. |
| 58 | Ausente | Doméstico | Fuera_de_Pantalla | **40%** | Volteó hacia la puerta y se fue. Audio doméstico atenúa, pero la ausencia prolongada sigue requiriendo revisión. |
| 59 | Ausente | Doméstico | Atención_Secundaria | **38%** | Audio doméstico + atención periférica residual + ausencia. |
| 60 | Ausente | Doméstico | Errático | **42%** | Audio doméstico debería calmar; el nerviosismo previo es ligeramente contradictorio. |
| 61 | Ausente | Sospechoso | Concentrado | **82%** | Se ocultó pero el micrófono captó lenguaje de trampa. Gaze residual "concentrado" reduce ligeramente (pudo haberse ido legitimamente mientras el audio captura TV o tercero). |
| 62 | Ausente | Sospechoso | Fuera_de_Pantalla | **88%** | Desapareció + mirada previa fuera de pantalla + voz sospechosa = salió del frame para comunicarse con alguien. |
| 63 | Ausente | Sospechoso | Atención_Secundaria | **85%** | Audio sospechoso dominante. Atención periférica sugiere interacción con fuente externa antes de desaparecer. |
| 64 | Ausente | Sospechoso | Errático | **90%** | **Máximo del grupo.** Nerviosismo previo + desaparición + voz sospechosa = ocultamiento deliberado para comunicarse. |

---

## Resumen Estadístico

| Grupo (Visión) | P(Fraude) Mínima | P(Fraude) Máxima | Promedio |
|---|---|---|---|
| `Objeto_Prohibido` | 60% | 99% | ~84% |
| `Multitud` | 78% | 95% | ~87% |
| `Normal` | 1% | 92% | ~30% |
| `Ausente` | 35% | 90% | ~55% |

---

## Principios de Calibración

Los 64 valores se derivaron de 5 reglas de inferencia probabilística:

### 1. Modelo Paramétrico Aditivo (Objeto_Prohibido)
La detección de un **objeto prohibido** es la señal visual más fuerte, pero YOLOv8 no es infalible (~95% precisión). Para evitar que un falso positivo del modelo condene automáticamente al estudiante, se aplica la fórmula $P = P_{base} + \Delta_A + \Delta_G$ con $P_{base} = 0.85$. Esto permite que los nodos de Audio y Mirada **modulen** la certeza entre 60% y 99%, reconociendo que la convergencia de múltiples sensores independientes es más confiable que cualquier detector aislado.

### 2. Sinergia Audio↔Mirada
Cuando el Audio y la Mirada **convergen** señalando la misma conclusión (ej. ambos indican deshonestidad), la probabilidad se multiplica exponencialmente. Cuando **divergen** (ej. audio sospechoso pero mirada concentrada), la probabilidad se atenúa significativamente. Esto modela el principio bayesiano de que evidencia independiente convergente es más confiable que cualquier señal aislada.

### 3. Atenuación Doméstica
El clasificador NLP de audio actúa como un **supressor de falsos positivos**. Si el semántico clasifica un audio como "doméstico" (interacción con familiar, ruido hogar), reduce la probabilidad de fraude incluso cuando la Mirada o la Visión presentan anomalías momentáneas. Esto protege al estudiante que vive en un entorno ruidoso o comparte espacio.

### 4. Degradación de Gaze en Ausencia
Cuando YOLO reporta `Ausente` (0 personas), los datos de Gaze Tracking son **residuales** (capturados antes de la desaparición) y su influencia se reduce a ±3-5%. El Audio se convierte en el sensor dominante para discriminar entre abandono legítimo y ocultamiento deliberado.

### 5. Asimetría de Certeza
La red **nunca** asigna 0% (principio bayesiano de no certeza absoluta) ni 100% (reconoce la posibilidad de error en los modelos de IA). El rango funcional es 1%–99%, donde:
- **1%** = comportamiento ideal, sin señales de alerta
- **99%** = convergencia máxima de todas las señales (celular + voz sospechosa + nerviosismo)
