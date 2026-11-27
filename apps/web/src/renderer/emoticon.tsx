/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ImgHTMLAttributes, type JSX, useState } from "react";
import { attributesToProps } from "html-react-parser";

import { type RendererMap } from "./utils.ts";

/**
 * Replaces custom emoticons with images which only animate while hovered, for when GIFs don't autoplay.
 */
export const emoticonRenderer: RendererMap = {
    img: (img) => {
        if (!("data-mx-emoticon" in img.attribs) || !img.attribs.src) return;
        return <Emoticon {...attributesToProps(img.attribs)} />;
    },
};

function Emoticon(props: ImgHTMLAttributes<HTMLImageElement>): JSX.Element {
    const [hovered, setHovered] = useState(false);

    let src = props.src;
    if (hovered && src) {
        const url = new URL(src);
        url.searchParams.set("animated", "true");
        src = url.href;
    }

    return (
        <img
            {...props}
            alt={props.alt ?? ""}
            src={src}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        />
    );
}
