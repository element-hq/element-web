/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { chatText, fetchWithProviderFallback, jsonError, providerHeaders, type Env } from "./_shared";

interface Context {
    request: Request;
    env: Env;
}

const NOT_CONFIGURED = "\u0041\u0049 \u670d\u52a1\u5c1a\u672a\u5b8c\u6210\u90e8\u7f72\u914d\u7f6e";
const INVALID_IMAGE = "\u7f3a\u5c11\u53ef\u8bc6\u522b\u7684\u56fe\u7247\u6570\u636e";
const UPSTREAM_UNAVAILABLE = "\u4e0a\u6e38 OCR \u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528";
const EMPTY_RESPONSE = "OCR \u670d\u52a1\u672a\u8fd4\u56de\u6587\u672c";

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
    if (!env.SPARK_API_KEY || !env.SPARK_BASE_URL || !env.SPARK_OCR_MODEL) {
        return jsonError(NOT_CONFIGURED, 503);
    }

    const body = (await request.json().catch(() => undefined)) as { image?: unknown } | undefined;
    if (typeof body?.image !== "string" || !body.image.startsWith("data:image/")) {
        return jsonError(INVALID_IMAGE);
    }

    let upstream: Response;
    try {
        upstream = await fetchWithProviderFallback(env, "/chat/completions", {
            method: "POST",
            headers: { ...providerHeaders(env), "content-type": "application/json" },
            body: JSON.stringify({
                model: env.SPARK_OCR_MODEL,
                temperature: 0,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Extract every visible character in reading order. Return plain text only; do not include Markdown, HTML, coordinates, or explanations.",
                            },
                            { type: "image_url", image_url: { url: body.image } },
                        ],
                    },
                ],
            }),
        });
    } catch {
        return jsonError(UPSTREAM_UNAVAILABLE, 502);
    }

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return jsonError(UPSTREAM_UNAVAILABLE, 502);

    const text = chatText(payload);
    return text ? Response.json({ text }) : jsonError(EMPTY_RESPONSE, 502);
};
