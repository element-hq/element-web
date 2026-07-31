/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { apiUrl, chatText, jsonError, providerHeaders, type Env } from "./_shared";

interface Context {
    request: Request;
    env: Env;
}

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
    if (!env.SPARK_API_KEY || !env.SPARK_BASE_URL || !env.SPARK_OCR_MODEL)
        return jsonError("AI 服务尚未完成部署配置", 503);
    const body = (await request.json().catch(() => undefined)) as { image?: unknown } | undefined;
    if (typeof body?.image !== "string" || !body.image.startsWith("data:image/"))
        return jsonError("缺少可识别的图片数据");

    const upstream = await fetch(apiUrl(env, "/chat/completions"), {
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
                            text: "识别图片中的全部文字，只返回清理后的纯文本，不要 Markdown、HTML、坐标或解释。",
                        },
                        { type: "image_url", image_url: { url: body.image } },
                    ],
                },
            ],
        }),
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return jsonError("上游 OCR 服务暂时不可用", 502);
    const text = chatText(payload);
    return text ? Response.json({ text }) : jsonError("OCR 服务未返回文本", 502);
};
