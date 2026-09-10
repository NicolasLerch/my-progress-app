# Importación de rutinas V1

En `/plans/new`, elegir **Importar rutina**, seleccionar un Excel (`.xlsx`, `.xls`) o PDF digital y pulsar **Importar rutina**. El archivo se extrae temporalmente en el backend, OpenAI interpreta el contenido y el catálogo local aporta las coincidencias. No se crean registros durante este proceso.

En **Revisá tu rutina**, corregir días, ejercicios y valores. Todas las sugerencias disponibles aparecen precargadas en el selector, incluidas las de confianza media o baja. Revisarlas y corregirlas si hace falta; se aceptan juntas al pulsar Crear rutina, sin confirmaciones por fila. Los ejercicios sin coincidencia requieren selección con el buscador actual o eliminación. Completar series, repeticiones y descanso ausentes (un cero escrito es un descanso válido). El peso y su unidad se conservan en notas editables. Pulsar **Crear rutina** activa el nuevo plan y archiva el anterior en la misma transacción existente.

## Configuración

- `OPENAI_API_KEY`: exclusivamente en backend; configurarla como secreto en el entorno de despliegue, nunca como variable pública ni en `fly.toml`.
- `OPENAI_ROUTINE_IMPORT_MODEL`: por defecto `gpt-4.1-mini`; debe soportar Responses y Structured Outputs.
- Sin key, la importación responde con un error controlado y la creación manual sigue disponible. No se han configurado secretos ni desplegado cambios.
- Nuevas dependencias backend: `@fastify/multipart`, `openai`, `pdf-parse` y SheetJS `xlsx` 0.20.3 desde su distribución oficial. Las resoluciones están fijadas en `pnpm-lock.yaml`.

## Contratos y límites

`POST /plans/import`: multipart con un archivo y la autenticación Supabase existente. Devuelve `{ routine, warnings }`, con IDs de filas, datos nullable y matching por ejercicio. La confirmación usa el `POST /plans` existente y vuelve a validar schema e IDs del catálogo.

La preview vive en memoria del cliente y se pierde al recargar. No hay tabla de importaciones, `importId`, archivos persistentes ni migraciones. Los buffers del archivo se descartan al terminar; los parsers se cargan sólo en el contexto de extracción. Excel usa un worker de hilos; PDF usa un proceso separado para aislar también el cierre de dependencias nativas en Windows. Se espera su cierre antes de liberar la importación; el timeout fuerza su terminación.

Límites iniciales: 5 MiB de archivo, 30 páginas/hojas, 60.000 caracteres serializados, 30.000 celdas, 20 MiB descomprimidos para XLSX, 15 segundos de extracción, heap de 128 MiB para Excel y 256 MiB para PDF y una importación simultánea por proceso. OpenAI tiene un timeout de 60 segundos, sin reintentos automáticos y un máximo de 16.000 tokens de salida. No se truncan documentos ni respuestas. Se registran duración y códigos de resultado, sin contenido ni secretos.

MIME vacío o genérico se admite sólo si extensión, firma y parser son consistentes. XLSX valida miembros ZIP y tamaño expandido antes de parsear. No se evalúan fórmulas: se conservan sus valores almacenados cuando existen. Los XLS históricos deben usar contenedor binario OLE; exportaciones HTML/XML renombradas como `.xls` deben guardarse como un Excel real.

Las coincidencias son heurísticas, no probabilidades. El vocabulario explícito en `exercise-vocabulary.ts` normaliza conectores, plurales, aliases completos y el sinónimo soga/cuerda (incluidos sogas/cuerdas). Se identifican movimiento, familia del press, inclinación, equipamiento y variantes. Primero se excluyen contradicciones explícitas (banca/francés, inclinado/declinado/plano, barra/mancuerna, agarre o unilateralidad); los atributos ausentes son desconocidos, no valores inferidos.

La puntuación compara características sin depender del orden: movimiento y familia pesan 4, variantes 3, equipo 2 y palabras restantes 1. Se suman los pesos de ambos nombres: características iguales reciben crédito completo y una característica presente sólo de un lado recibe medio crédito. Las palabras restantes sin coincidencia no reciben crédito; un error de edición de un carácter entre palabras no clasificadas de al menos cuatro letras recibe el 80%. Nunca se aplican aproximaciones a palabras clasificadas como inclinado/declinado.

Nombre normalizado exacto o alias completo único: `high`. Movimiento conocido compatible, puntuación >= 0,85 y margen >= 0,10: `medium`, con aviso para revisar. Puntuación >= 0,65 o ambigüedad: `low`, con aviso de sugerencia dudosa. Sin candidatos compatibles suficientes: `unresolved`, sin sugerencia. Una búsqueda genérica como «press con barra» conserva confianza baja si sugiere una variante específica; el usuario puede corregir la selección precargada. «Press banca con barra» puede sugerir «Press banca» como media porque falta el equipo en el catálogo. No se crean ejercicios automáticamente ni se agregan llamadas a IA para matching. El vocabulario es conservador y ampliable mediante reglas y tests; los sinónimos no incluidos pueden requerir selección manual.

Errores de extracción diferenciados: `EXTRACTION_MEMORY`, `EXTRACTION_TIMEOUT`, `EXTRACTION_INIT`, `EXTRACTION_FAILED` y `EXTRACTION_EXIT`. Los diagnósticos nativos no se muestran al usuario ni se registran con el contenido del documento. La validación de upload no importa PDF/Excel en el proceso HTTP. El parser PDF se carga antes del loader TypeScript de desarrollo.

Superseries: sólo dos ejercicios consecutivos con series y descanso explícitos e iguales. Otras agrupaciones se conservan en notas con advertencia. Las notas finales deben caber en los 300 caracteres del dominio y las repeticiones en 30; la UI pide edición cuando exceden esos límites.

Los descansos se extraen literalmente como estText en el contrato interno con IA y se convierten determinísticamente en el backend. Un rango como «2-3 min» o «2 a 3 min» usa su extremo superior (180 segundos) y conserva la prescripción original en notas. También se admiten segundos, decimales y guiones Unicode; no se evalúan operaciones aritméticas. Si faltan unidades o el texto es ambiguo/negativo, se conserva en notas y el descanso queda vacío para completarlo en la preview. El contrato público sigue usando restSeconds; no hay migraciones.

## Pruebas

En Windows usar `pnpm.cmd` si PowerShell bloquea `pnpm.ps1`.

```sh
pnpm --filter backend test
pnpm --filter backend test:compiled
pnpm --filter @my-progress/shared test
pnpm typecheck
pnpm lint
pnpm build
```

El test PostgreSQL requiere `TEST_DATABASE_URL` apuntando a una base **de pruebas** con el schema Prisma aplicado. Nunca toma `DATABASE_URL` como fallback. Crea IDs aleatorios y elimina únicamente sus registros. Sin esa variable se informa como omitido. Los demás tests no necesitan base ni credenciales de IA.

Verificación manual en móvil: subir un archivo de varias hojas o PDF digital; comprobar nombres y rangos; resolver un ejercicio no encontrado; dejar descanso vacío para verificar el bloqueo; ingresar cero; eliminar una fila o día; editar notas; confirmar y verificar el detalle del plan. Probar archivo corrupto, PDF escaneado, formato no admitido, desconexión y error de creación: la preview debe conservarse para corregir o reintentar. Comparar la interpretación real con el documento: las pruebas automáticas mockean OpenAI y no miden su precisión.

La validación del contenedor requiere Docker y un PDF digital de prueba: construir `backend/Dockerfile` y ejecutar la extracción dentro de la imagen antes del despliegue.

Resultado de la verificación local: 46 pruebas aprobadas (35 backend, 2 de extracción compilada y 9 compartidas), una prueba PostgreSQL omitida por falta de `TEST_DATABASE_URL`; typecheck y build aprobados. `pnpm lint` se intentó, pero el frontend ya referencia un ESLint que no está instalado ni configurado en el proyecto. No había Docker disponible para la prueba Alpine. No se hicieron llamadas reales a OpenAI ni una prueba interactiva móvil; quedan para la validación con credenciales y documentos del usuario.

## Archivos

- Nuevos: `packages/shared/src/routine-import.ts`, `packages/shared/test/routine-import.test.mjs`; servicios en `backend/src/services/routine-import/` (`errors`, `upload-validation`, `extractors`, `extraction-worker`, `interpreter`, `exercise-vocabulary`, `matcher`, `service`, `routes`); tests `backend/test/routine-import.test.ts`, `backend/test/exercise-matching.test.ts`, `backend/test/compiled-extraction.check.mjs`, fixture `backend/test/pdf-fixture.mjs` y `backend/test/plan-import-persistence.test.ts`; `frontend/components/plans/routine-import-upload.tsx`; este documento.
- Modificados: exportaciones y scripts del paquete compartido; `backend/package.json`, `backend/src/routes.ts`, `backend/src/repositories/prisma-repository.ts`; `frontend/lib/api.ts`, `frontend/app/plans/new/page.tsx`, `frontend/components/plans/plan-form.tsx`; `.env.example` y `pnpm-lock.yaml`.

Quedan fuera de V1 imágenes, OCR, PDFs escaneados, CSV, texto pegado y matching semántico. Se pueden incorporar nuevos extractores mediante `RawRoutineContent` o sustituir intérprete/matcher sin cambiar la preview ni la persistencia.
