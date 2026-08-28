/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { z } from "zod";

import {
    MXC_REGEX,
    PACK_IMPORT_SCHEMA_VERSION,
    SHORTCODE_REGEX,
    type EmoteDefinition,
    type ImagePackDefinition,
    type PackImportPayload,
} from "./types.ts";

export class PackImportError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "PackImportError";
    }
}

const mxc = z.string().regex(MXC_REGEX, { message: "Must be an mxc:// URL." });
const shortcode = z.string().regex(SHORTCODE_REGEX, {
    message: `Must match ${SHORTCODE_REGEX.source}.`,
});

const wireImage = z.object({
    url: mxc,
    body: z.string().optional(),
    info: z.record(z.string(), z.unknown()).optional(),
});

const wirePackMeta = z.object({
    display_name: z.string().optional(),
    avatar_url: mxc.optional(),
    attribution: z.string().optional(),
    usage: z.array(z.string()).optional(),
});

const wirePackContent = z.object({
    images: z.record(shortcode, wireImage),
    pack: wirePackMeta.optional(),
});

const camelPackContent = z.object({
    displayName: z.string().optional(),
    avatarUrl: mxc.optional(),
    attribution: z.string().optional(),
    usage: z.array(z.string()).optional(),
    images: z.record(
        shortcode,
        z.object({
            shortcode: shortcode.optional(),
            url: mxc,
            body: z.string().optional(),
            info: z.record(z.string(), z.unknown()).optional(),
        }),
    ),
});

function fromWireContent(value: z.infer<typeof wirePackContent>, fallbackDisplayName = ""): ImagePackDefinition {
    const def: ImagePackDefinition = {
        displayName: value.pack?.display_name?.trim() || fallbackDisplayName,
        images: Object.fromEntries(Object.entries(value.images).map(([k, v]) => [k, toEmote(k, v)])),
    };
    if (value.pack?.avatar_url) def.avatarUrl = value.pack.avatar_url;
    if (value.pack?.attribution) def.attribution = value.pack.attribution;
    if (value.pack?.usage !== undefined) def.usage = value.pack.usage;
    return def;
}

function fromCamelContent(value: z.infer<typeof camelPackContent>, fallbackDisplayName = ""): ImagePackDefinition {
    const def: ImagePackDefinition = {
        displayName: value.displayName?.trim() || fallbackDisplayName,
        images: Object.fromEntries(Object.entries(value.images).map(([k, v]) => [k, toEmote(k, v)])),
    };
    if (value.avatarUrl) def.avatarUrl = value.avatarUrl;
    if (value.attribution) def.attribution = value.attribution;
    if (value.usage !== undefined) def.usage = value.usage;
    return def;
}

function toEmote(key: string, value: { url: string; body?: string; info?: Record<string, unknown> }): EmoteDefinition {
    const out: EmoteDefinition = { shortcode: key, url: value.url };
    if (value.body !== undefined) out.body = value.body;
    if (value.info) out.info = value.info;
    return out;
}

/**
 * Parse and validate a pack JSON payload produced by {@link exportPackJson}.
 * Accepts raw MSC2545 content and the former versioned module envelopes.
 *
 * Throws {@link PackImportError} if the input does not match the expected
 * schema. The function is intentionally strict — clients should not silently
 * accept malformed packs.
 */
export function parsePackJson(input: unknown, fallbackDisplayName = ""): ImagePackDefinition {
    if (typeof input !== "object" || input === null) {
        throw new PackImportError("Pack JSON must be an object.");
    }
    const obj = input as Record<string, unknown>;

    if (obj.version === PACK_IMPORT_SCHEMA_VERSION && "pack" in obj) {
        if (typeof obj.pack !== "object" || obj.pack === null) {
            throw new PackImportError("Invalid pack JSON.");
        }
        if ("displayName" in obj.pack) {
            const parsed = z
                .object({ version: z.literal(PACK_IMPORT_SCHEMA_VERSION), pack: camelPackContent })
                .safeParse(obj);
            if (!parsed.success) throw new PackImportError(parsed.error.issues[0]?.message ?? "Invalid pack JSON.");
            return fromCamelContent(parsed.data.pack, fallbackDisplayName);
        }
        const parsed = z
            .object({ version: z.literal(PACK_IMPORT_SCHEMA_VERSION), pack: wirePackContent })
            .safeParse(obj);
        if (!parsed.success) throw new PackImportError(parsed.error.issues[0]?.message ?? "Invalid pack JSON.");
        return fromWireContent(parsed.data.pack, fallbackDisplayName);
    }
    if ("displayName" in obj) {
        const parsed = camelPackContent.safeParse(obj);
        if (!parsed.success) throw new PackImportError(parsed.error.issues[0]?.message ?? "Invalid pack JSON.");
        return fromCamelContent(parsed.data, fallbackDisplayName);
    }
    if ("images" in obj) {
        const parsed = wirePackContent.safeParse(obj);
        if (!parsed.success) throw new PackImportError(parsed.error.issues[0]?.message ?? "Invalid pack JSON.");
        return fromWireContent(parsed.data, fallbackDisplayName);
    }
    throw new PackImportError("Pack JSON missing required `images` key.");
}

/**
 * Serialise a pack to the raw MSC2545 wire shape. The output can be consumed
 * directly by clients which do not know about this module's former envelope.
 */
export function exportPackJson(pack: ImagePackDefinition): PackImportPayload {
    const images: PackImportPayload["images"] = {};
    for (const [shortcode, image] of Object.entries(pack.images)) {
        if (!SHORTCODE_REGEX.test(shortcode)) {
            throw new PackImportError(`Invalid shortcode "${shortcode}". Must match ${SHORTCODE_REGEX.source}.`);
        }
        if (!MXC_REGEX.test(image.url)) {
            throw new PackImportError(`Invalid MXC URL "${image.url}".`);
        }
        const emote: PackImportPayload["images"][string] = { url: image.url };
        if (image.body !== undefined) emote.body = image.body;
        if (image.info) emote.info = image.info;
        images[shortcode] = emote;
    }
    const out: PackImportPayload = { images };
    const metadata: NonNullable<PackImportPayload["pack"]> = {};
    if (pack.displayName.trim()) metadata.display_name = pack.displayName.trim();
    if (pack.avatarUrl !== undefined) metadata.avatar_url = pack.avatarUrl;
    if (pack.attribution !== undefined) metadata.attribution = pack.attribution;
    if (pack.usage !== undefined) metadata.usage = [...pack.usage];
    if (Object.keys(metadata).length > 0) out.pack = metadata;
    return out;
}
