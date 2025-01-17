/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";

import type { IContent } from "matrix-js-sdk/src/matrix";
import type React from "react";
import { editBodyDiffToHtml } from "../../../src/utils/MessageDiffUtils";

describe("editBodyDiffToHtml", () => {
    function buildContent(message: string): IContent {
        return {
            body: message,
            format: "org.matrix.custom.html",
            formatted_body: message,
            msgtype: "m.text",
        };
    }

    function renderDiff(before: string, after: string) {
        const node = editBodyDiffToHtml(buildContent(before), buildContent(after));

        return render(node as React.ReactElement);
    }

    it.each([
        ["simple word changes", "hello", "world"],
        ["central word changes", "beginning middle end", "beginning :smile: end"],
        ["text deletions", "<b>hello</b> world", "<b>hello</b>"],
        ["text additions", "<b>hello</b>", "<b>hello</b> world"],
        ["block element additions", "hello", "hello <p>world</p>"],
        ["inline element additions", "hello", "hello <q>world</q>"],
        ["block element deletions", `hi <blockquote>there</blockquote>`, "hi"],
        ["inline element deletions", `hi <em>there</em>`, "hi"],
        ["element replacements", `hi <i>there</i>`, "hi <em>there</em>"],
        ["attribute modifications", `<a href="#hi">hi</a>`, `<a href="#bye">hi</a>`],
        ["attribute deletions", `<a href="#hi">hi</a>`, `<a>hi</a>`],
        ["attribute additions", `<a>hi</a>`, `<a href="#/room/!123">hi</a>`],
        ["handles empty tags", `<a>hi</a>`, `<a><h1></h1></a> hi`],
    ])("renders %s", (_label, before, after) => {
        const { container } = renderDiff(before, after);
        expect(container).toMatchSnapshot();
    });

    // see https://github.com/fiduswriter/diffDOM/issues/90
    // fixed in diff-dom in 4.2.2+
    it("deduplicates diff steps", () => {
        const { container } = renderDiff("<div><em>foo</em> bar baz</div>", "<div><em>foo</em> bar bay</div>");
        expect(container).toMatchSnapshot();
    });

    it("handles non-html input", () => {
        const before: IContent = {
            body: "who knows what's going on <strong>here</strong>",
            format: "org.exotic.encoding",
            formatted_body: "who knows what's going on <strong>here</strong>",
            msgtype: "m.text",
        };

        const after: IContent = {
            ...before,
            body: "who knows what's going on <strong>there</strong>",
            formatted_body: "who knows what's going on <strong>there</strong>",
        };

        const { container } = render(editBodyDiffToHtml(before, after) as React.ReactElement);
        expect(container).toMatchSnapshot();
    });

    // see https://github.com/vector-im/element-web/issues/23665
    it("handles complex transformations", () => {
        const { container } = renderDiff(
            '<span data-mx-maths="{☃️}^\\infty"><code>{☃️}^\\infty</code></span>',
            '<span data-mx-maths="{😃}^\\infty"><code>{😃}^\\infty</code></span>',
        );
        expect(container).toMatchSnapshot();
    });
});
