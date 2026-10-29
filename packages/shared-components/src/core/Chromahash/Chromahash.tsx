/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type CSSProperties, type JSX, useLayoutEffect, useMemo, useRef } from "react";
import { decode, type DecodedImage } from "@visualcommons/chromahash/decode";

export interface ChromahashProps {
    /**
     * Unpadded base64 encoding of the ChromaHash bytes.
     */
    hash: string;
    /**
     * Rendered width of the placeholder, in pixels or any CSS length.
     */
    width: number | string;
    /**
     * Rendered height of the placeholder, in pixels or any CSS length.
     */
    height: number | string;
    /**
     * Optional CSS class applied to the wrapper element.
     */
    className?: string;
}

const canvasStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
};

/**
 * Decode a base64 ChromaHash, returning null if it is malformed.
 */
function decodeHash(hash: string): DecodedImage | null {
    try {
        return decode(Uint8Array.from(atob(hash), (c) => c.charCodeAt(0)));
    } catch {
        return null;
    }
}

/**
 * Renders a ChromaHash image placeholder.
 *
 * Mirrors the DOM of `react-blurhash`'s `Blurhash` (a sized wrapper around a stretched canvas) so it can be
 * swapped in without changing the surrounding styles. The canvas is drawn at the hash's natural resolution and
 * stretched with CSS to fill `width` x `height`, ignoring the aspect ratio embedded in the hash so the placeholder
 * matches the media's own dimensions if the two disagree. Renders an empty wrapper if the hash cannot be decoded.
 *
 * @example
 * ```tsx
 * <Chromahash hash={hash} width={320} height={240} />
 * ```
 */
export function Chromahash({ hash, width, height, className }: Readonly<ChromahashProps>): JSX.Element {
    const canvas = useRef<HTMLCanvasElement>(null);
    const image = useMemo(() => decodeHash(hash), [hash]);

    useLayoutEffect(() => {
        const ctx = canvas.current?.getContext("2d");
        if (!ctx || !image) return;
        const imageData = ctx.createImageData(image.w, image.h);
        imageData.data.set(image.rgba);
        ctx.putImageData(imageData, 0, 0);
    }, [image]);

    return (
        <div className={className} style={{ display: "inline-block", position: "relative", width, height }}>
            {image && <canvas ref={canvas} width={image.w} height={image.h} style={canvasStyle} />}
        </div>
    );
}
