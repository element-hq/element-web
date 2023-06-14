/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { render } from "@testing-library/react";

import type { IContent } from "matrix-js-sdk/src/matrix";
import type React from "react";
import { editBodyDiffToHtml } from "../../src/utils/MessageDiffUtils";

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
