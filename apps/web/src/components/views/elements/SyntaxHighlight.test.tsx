// Copyright 2024 New Vector Ltd.
// Copyright 2023 The Matrix.org Foundation C.I.C.
//
// SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "test-utils-rtl";
import hljs, { type HighlightOptions } from "highlight.js";
import React from "react";

import SyntaxHighlight from "./SyntaxHighlight";

describe("<SyntaxHighlight />", () => {
    it("renders", async () => {
        const { container } = render(
            <SyntaxHighlight language="javascript">console.log("Hello, World!");</SyntaxHighlight>,
        );
        await waitFor(() => expect(container.querySelector(".language-javascript")).toBeTruthy());
        expect(container).toMatchSnapshot();
    });

    it.each(["json", "javascript", "css"])("uses the provided language", async (lang) => {
        const mock = vi.spyOn(hljs, "highlight");

        // oxlint-disable-next-line react/jsx-no-comment-textnodes
        const { container } = render(<SyntaxHighlight language={lang}>// Hello, World</SyntaxHighlight>);
        await waitFor(() => expect(container.querySelector(`.language-${lang}`)).toBeTruthy());

        const [, opts] = mock.mock.lastCall!;
        expect((opts as unknown as HighlightOptions)["language"]).toBe(lang);
    });
});
