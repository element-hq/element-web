/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { apiUrl, jsonError, providerHeaders, type Env } from "./_shared";

interface Context {
    request: Request;
    env: Env;
}

const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
    if (!env.SPARK_API_KEY || !env.SPARK_BASE_URL || !env.SPARK_ASR_MODEL)
        return jsonError("AI 服务尚未完成部署配置", 503);
    const requestForm = await request.formData().catch(() => undefined);
    const audio = requestForm?.get("file");
    if (!(audio instanceof File)) return jsonError("缺少音频文件");
    if (audio.size > MAX_AUDIO_SIZE) return jsonError("音频转写仅支持不超过 25 MB 的文件", 413);

    const form = new FormData();
    form.append("model", env.SPARK_ASR_MODEL);
    form.append("file", audio, audio.name || "audio");
    const upstream = await fetch(apiUrl(env, "/audio/transcriptions"), {
        method: "POST",
        headers: providerHeaders(env),
        body: form,
    });
    const payload = (await upstream.json().catch(() => ({}))) as { text?: unknown };
    if (!upstream.ok) return jsonError("上游转写服务暂时不可用", 502);
    return typeof payload.text === "string" && payload.text.trim()
        ? Response.json({ text: payload.text.trim() })
        : jsonError("转写服务未返回文本", 502);
};
