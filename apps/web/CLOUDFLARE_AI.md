# Cloudflare Pages AI functions

The web client calls same-origin `/api/ai/ocr` and `/api/ai/transcribe`. The Pages Functions in `functions/api/ai` proxy an OpenAI-compatible Spark endpoint, so no API key reaches the browser or Matrix account data.

Set these Pages environment variables before deployment:

- `SPARK_BASE_URL` — API version prefix, for example `https://<provider>/v1`
- `SPARK_OCR_MODEL` — optional image-capable OCR model. Defaults to `glm-4.6v`.
- `SPARK_ASR_MODEL` — optional audio-transcription model. Defaults to `whisper-large-v3-turbo`.

Set `SPARK_API_KEY` as an encrypted Cloudflare secret, never as a plain build variable or `config.json` value. The worker limits uploaded audio to 25 MB.
