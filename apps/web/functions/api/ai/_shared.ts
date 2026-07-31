/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

export interface Env {
    SPARK_API_KEY: string;
    /** OpenAI-compatible API prefix, for example https://example.invalid/v1 */
    SPARK_BASE_URL: string;
    SPARK_OCR_MODEL: string;
    SPARK_ASR_MODEL: string;
}

export const jsonError = (error: string, status = 400): Response =>
    Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export const apiUrl = (env: Env, path: string): string => `${env.SPARK_BASE_URL.replace(/\/$/, "")}${path}`;

export const providerHeaders = (env: Env): HeadersInit => ({ authorization: `Bearer ${env.SPARK_API_KEY}` });

export const chatText = (payload: unknown): string | undefined => {
    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message
        ?.content;
    if (typeof content === "string") return content.trim();
    if (!Array.isArray(content)) return undefined;
    return content
        .map((part) =>
            typeof part === "object" && part && "text" in part ? String((part as { text: unknown }).text) : "",
        )
        .join("\n")
        .trim();
};
