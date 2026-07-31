/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

const responseText = async (response: Response): Promise<string> => {
    const payload = (await response.json().catch(() => ({}))) as { text?: unknown; error?: unknown };
    if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : `AI 服务请求失败（${response.status}）`);
    if (typeof payload.text !== "string" || !payload.text.trim()) throw new Error("AI 服务未返回可用文本");
    return payload.text.trim();
};

const toDataUrl = async (blob: Blob): Promise<string> => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
};

/** Same-origin request: provider keys stay in the Cloudflare Worker, never in Element or account data. */
export const recogniseImage = async (image: Blob): Promise<string> => {
    const response = await fetch("/api/ai/ocr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: await toDataUrl(image) }),
    });
    return responseText(response);
};

export const transcribeAudio = async (audio: Blob, filename: string): Promise<string> => {
    if (audio.size > MAX_AUDIO_SIZE) throw new Error("音频转写仅支持不超过 25 MB 的文件");
    const formData = new FormData();
    formData.append("file", new File([audio], filename || "audio", { type: audio.type || "audio/*" }));
    return responseText(await fetch("/api/ai/transcribe", { method: "POST", body: formData }));
};
