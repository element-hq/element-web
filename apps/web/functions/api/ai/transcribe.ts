/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { fetchWithProviderFallback, jsonError, providerHeaders, type Env } from "./_shared";

interface Context {
    request: Request;
    env: Env;
}

const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const NOT_CONFIGURED = "\u0041\u0049 \u670d\u52a1\u5c1a\u672a\u5b8c\u6210\u90e8\u7f72\u914d\u7f6e";
const MISSING_AUDIO = "\u7f3a\u5c11\u97f3\u9891\u6587\u4ef6";
const TOO_LARGE = "\u97f3\u9891\u8f6c\u5199\u4ec5\u652f\u6301\u4e0d\u8d85\u8fc7 25 MB \u7684\u6587\u4ef6";
const UPSTREAM_UNAVAILABLE = "\u4e0a\u6e38\u8f6c\u5199\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528";
const EMPTY_RESPONSE = "\u8f6c\u5199\u670d\u52a1\u672a\u8fd4\u56de\u6587\u672c";
const DEFAULT_ASR_MODEL = "whisper-large-v3-turbo";
const ASR_MODEL_FALLBACKS = ["gpt-4o-transcribe-diarize"];

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
    if (!env.SPARK_API_KEY || !env.SPARK_BASE_URL) {
        return jsonError(NOT_CONFIGURED, 503);
    }

    const requestForm = await request.formData().catch(() => undefined);
    const audio = requestForm?.get("file");
    if (!(audio instanceof File)) return jsonError(MISSING_AUDIO);
    if (audio.size > MAX_AUDIO_SIZE) return jsonError(TOO_LARGE, 413);

    let lastStatus: number | undefined;
    let receivedSuccessfulResponse = false;

    for (const model of new Set([env.SPARK_ASR_MODEL || DEFAULT_ASR_MODEL, ...ASR_MODEL_FALLBACKS])) {
        const form = new FormData();
        form.append("model", model);
        form.append("file", audio, audio.name || "voice-message.ogg");
        form.append("language", "zh");
        form.append("temperature", "0.2");

        try {
            const upstream = await fetchWithProviderFallback(env, "/audio/transcriptions", {
                method: "POST",
                headers: providerHeaders(env),
                body: form,
            });
            lastStatus = upstream.status;
            const payload = (await upstream.json().catch(() => ({}))) as { text?: unknown };
            if (!upstream.ok) continue;

            receivedSuccessfulResponse = true;
            if (typeof payload.text === "string" && payload.text.trim()) {
                return Response.json({ text: payload.text.trim() });
            }
        } catch {
            // Try a compatible model before declaring the provider unavailable.
        }
    }

    return receivedSuccessfulResponse
        ? jsonError(EMPTY_RESPONSE, 502)
        : lastStatus
          ? jsonError(`${UPSTREAM_UNAVAILABLE} (HTTP ${lastStatus})`, 502)
          : jsonError(UPSTREAM_UNAVAILABLE, 502);
};
