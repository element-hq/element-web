/* eslint @typescript-eslint/no-unused-vars: ["error", { "varsIgnorePattern": "^_" }] */
// Copyright 2024 New Vector Ltd.
// Copyright 2023 The Matrix.org Foundation C.I.C.
//
// SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
// Please see LICENSE files in the repository root for full details.

import { render, waitFor } from "@testing-library/react";
import hljs, { type HighlightOptions } from "highlight.js";
import React from "react";

import SyntaxHighlight from "../../../../src/components/views/elements/SyntaxHighlight";

describe("<SyntaxHighlight />", () => {
    it("renders", async () => {
        const { container } = render(<SyntaxHighlight>console.log("Hello, World!");</SyntaxHighlight>);
        await waitFor(() => expect(container.querySelector(".language-arcade")).toBeTruthy());
        expect(container).toMatchSnapshot();
    });

    it.each(["json", "javascript", "css"])("uses the provided language", async (lang) => {
        const mock = jest.spyOn(hljs, "highlight");

        const { container } = render(<SyntaxHighlight language={lang}>// Hello, World</SyntaxHighlight>);
        await waitFor(() => expect(container.querySelector(`.language-${lang}`)).toBeTruthy());

        const [_lang, opts] = mock.mock.lastCall!;
        expect((opts as unknown as HighlightOptions)["language"]).toBe(lang);
    });
});
