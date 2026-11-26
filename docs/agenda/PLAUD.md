# Integración de Plaud con AGENDA (Discurso / Reunión → Tareas)

AGENDA permite transformar grabaciones, minutas y discursos del Despacho Ministerial en tareas asignadas con trazabilidad documental, manteniendo los datos y la inferencia dentro de la infraestructura institucional.

## Flujo completo

1. **Grabación en Plaud**: el equipo graba la reunión o intervención en el dispositivo Plaud (Note / Pin).
2. **Sincronización con la app Plaud**: al finalizar, la grabación se sincroniza con la aplicación de Plaud y genera la transcripción y el resumen.
3. **Importación en AGENDA**:
   - **Vía CLI de Plaud** (`@plaud-ai/cli`): desde la pestaña **Plaud** del módulo **Discurso / Reunión** en AGENDA, se consultan las grabaciones recientes y se importa la transcripción o resumen con un clic.
   - **Vía archivo o texto**: si aún no se conecta la CLI, se puede exportar la transcripción desde Plaud en `.txt`, `.md`, `.vtt`, `.srt` o `.json` y subirla o pegarla directamente.
   - **Vía MCP (opcional)**: un agente o cliente compatible puede leer la transcripción de Plaud y enviarla a `POST /api/discurso/extraer`.
4. **Extracción con IA local (Ollama)**:
   - AGENDA envía la transcripción normalizada a la instancia local de **Ollama** (`AGENDA_LLM_URL`, modelo por defecto `qwen3:8b`, sin envío a nubes externas).
   - Las transcripciones largas (>3.500 caracteres) se fragmentan con solapamiento y se deduplican automáticamente.
   - Si Ollama no está disponible o devuelve un formato inválido, AGENDA activa automáticamente el **extractor determinista por reglas** (`extractor-reglas.ts`) e interpreta los plazos en español venezolano (`America/Caracas`, UTC-4).
5. **Resolución de responsables SIGEFANB y Acta Borrador**:
   - Cada orden extraída cruza grados, componentes (`EJB`, `ARB`, `AMB`, `GNB`, `MIL`) y apellidos contra el directorio activo de SIGEFANB (`buscarPersonalInteligente`).
   - Los resultados quedan persistidos en un **Acta Borrador** editable donde el analista o secretaría revisa título, proyecto destino, responsable (asignación automática, sugerida o búsqueda manual), fecha límite y prioridad.
6. **Aprobación en lote y notificación**:
   - Al pulsar **Crear N tareas**, AGENDA aprovisiona de forma idempotente a los responsables seleccionados en el espacio de trabajo, crea las tareas con etiqueta **`ORDEN`**, adjunta la cita textual y el origen del acta en la descripción y registra la actividad correspondiente.

---

## Conectar Plaud mediante CLI (`@plaud-ai/cli`)

En el servidor donde corre la API de AGENDA (con el usuario del servicio):

```bash
npm i -g @plaud-ai/cli
plaud login
```

Al completar `plaud login`, las credenciales se guardan localmente en `~/.plaud/tokens.json` (se puede personalizar la ruta con `PLAUD_TOKENS_PATH`).

### Verificación rápida

- En terminal:
  ```bash
  plaud --version
  plaud recent --days 14 --json
  ```
- En AGENDA: ir a **Discurso / Reunión** → pestaña **Plaud**. Si la CLI y `~/.plaud/tokens.json` están presentes, aparecerá el listado de grabaciones recientes listas para importar.

---

## Opción alternativa vía MCP o exportación de archivos

- **Exportación manual**: desde la app web o móvil de Plaud, exportar la transcripción como `.txt`, `.md`, `.srt`, `.vtt` o `.json` y cargarla en la pestaña **Subir archivo** de AGENDA.
- **MCP**: si utilizas un servidor MCP de Plaud en tu flujo de trabajo, el cliente MCP puede invocar los endpoints autenticados de AGENDA:
  - `POST /api/discurso/extraer` para generar el acta borrador.
  - `POST /api/discurso/borradores/:id/aprobar` tras la revisión humana.

---

## Variables de entorno relevantes (API)

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `AGENDA_LLM_URL` | `http://127.0.0.1:11434` | URL base del servidor local Ollama |
| `AGENDA_LLM_MODEL` | `qwen3:8b` | Modelo Ollama utilizado para extracción estructurada |
| `PLAUD_TOKENS_PATH` | `~/.plaud/tokens.json` | Ruta al archivo de credenciales locales de Plaud CLI |
