/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

export interface Env {
    SPARK_API_KEY: string;
    /** OpenAI-compatible API prefix, for example https://example.invalid/v1 */
    SPARK_BASE_URL: string;
    /** Optional backup OpenAI-compatible endpoint for transient regional failures. */
    SPARK_FALLBACK_BASE_URL?: string;
    /** Optional override. The Pages functions provide a Spark-compatible default. */
    SPARK_OCR_MODEL?: string;
    /** Optional override. The Pages functions provide a Spark-compatible default. */
    SPARK_ASR_MODEL?: string;
}

export const jsonError = (error: string, status = 400): Response =>
    Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export const apiUrl = (env: Env, path: string): string => `${env.SPARK_BASE_URL.replace(/\/$/, "")}${path}`;

const providerUrls = (env: Env, path: string): string[] =>
    [env.SPARK_BASE_URL, env.SPARK_FALLBACK_BASE_URL]
        .filter((baseUrl): baseUrl is string => typeof baseUrl === "string" && baseUrl.length > 0)
        .map((baseUrl) => `${baseUrl.replace(/\/$/, "")}${path}`)
        .filter((url, index, urls) => urls.indexOf(url) === index);

/** Prefer Inferera but retry the same API key against AIHubMix's standard endpoint. */
export const fetchWithProviderFallback = async (env: Env, path: string, init: RequestInit): Promise<Response> => {
    let lastResponse: Response | undefined;
    let lastError: unknown;

    for (const url of providerUrls(env, path)) {
        try {
            const response = await fetch(url, init);
            if (response.ok) return response;
            lastResponse = response;
        } catch (error) {
            lastError = error;
        }
    }

    if (lastResponse) return lastResponse;
    throw lastError ?? new Error("No AI provider endpoint is configured");
};

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
