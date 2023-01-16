/* eslint @typescript-eslint/no-unused-vars: ["error", { "varsIgnorePattern": "^_" }] */
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
import hljs, { type HighlightOptions } from "highlight.js";
import React from "react";

import SyntaxHighlight from "../../../../src/components/views/elements/SyntaxHighlight";

describe("<SyntaxHighlight />", () => {
    it("renders", () => {
        const { container } = render(<SyntaxHighlight>console.log("Hello, World!");</SyntaxHighlight>);
        expect(container).toMatchSnapshot();
    });

    it.each(["json", "javascript", "css"])("uses the provided language", (lang) => {
        const mock = jest.spyOn(hljs, "highlight");

        render(<SyntaxHighlight language={lang}>// Hello, World</SyntaxHighlight>);

        const [_lang, opts] = mock.mock.lastCall!;
        expect((opts as HighlightOptions)["language"]).toBe(lang);
    });
});
