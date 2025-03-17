/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type * as commonmark from "commonmark";

declare module "commonmark" {
    export type Attr = [key: string, value: string];

    /* eslint-disable @typescript-eslint/naming-convention */
    export interface HtmlRenderer {
        // As far as @types/commonmark is concerned, these are not public, so add them
        // https://github.com/commonmark/commonmark.js/blob/master/lib/render/html.js#L272-L296
        text: (this: commonmark.HtmlRenderer, node: commonmark.Node) => void;
        html_inline: (this: commonmark.HtmlRenderer, node: commonmark.Node) => void;
        html_block: (this: commonmark.HtmlRenderer, node: commonmark.Node) => void;
        // softbreak: () => void; // This one can't be correctly specified as it is wrongly defined in @types/commonmark
        linebreak: (this: commonmark.HtmlRenderer) => void;
        link: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        image: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        emph: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        strong: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        paragraph: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        heading: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        code: (this: commonmark.HtmlRenderer, node: commonmark.Node) => void;
        code_block: (this: commonmark.HtmlRenderer, node: commonmark.Node) => void;
        thematic_break: (this: commonmark.HtmlRenderer, node: commonmark.Node) => void;
        block_quote: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        list: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        item: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        custom_inline: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        custom_block: (this: commonmark.HtmlRenderer, node: commonmark.Node, entering: boolean) => void;
        esc: (s: string) => string;
        out: (this: commonmark.HtmlRenderer, text: string) => void;
        tag: (this: commonmark.HtmlRenderer, name: string, attrs?: Attr[], selfClosing?: boolean) => void;
        attrs: (this: commonmark.HtmlRenderer, node: commonmark.Node) => Attr[];
        // These are inherited from the base Renderer
        lit: (this: commonmark.HtmlRenderer, text: string) => void;
        cr: (this: commonmark.HtmlRenderer) => void;
    }
    /* eslint-enable @typescript-eslint/naming-convention */
}
