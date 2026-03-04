/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { screen, fireEvent, render, type RenderResult } from "jest-matrix-react";
import parse from "html-react-parser";

import { ambiguousLinkTooltipRenderer, combineRenderers } from "../../../src/renderer";
import PlatformPeg from "../../../src/PlatformPeg";
import type BasePlatform from "../../../src/BasePlatform";

describe("link-tooltip", () => {
    jest.spyOn(PlatformPeg, "get").mockReturnValue({ needsUrlTooltips: () => true } as unknown as BasePlatform);

    function renderTooltips(input: string): RenderResult {
        return render(
            <>
                {parse(input, {
                    replace: combineRenderers(ambiguousLinkTooltipRenderer)({ isHtml: true }),
                })}
            </>,
        );
    }

    it("does nothing for empty element", () => {
        const { asFragment } = renderTooltips("<div></div>");
        expect(asFragment()).toMatchSnapshot();
    });

    it("wraps single anchor", () => {
        const { container, asFragment } = renderTooltips(`
            <div>
                <a href="/foo">click</a>
            </div>
        `);
        expect(asFragment()).toMatchSnapshot();
        const anchor = container.querySelector("a")!;
        expect(anchor.getAttribute("href")).toEqual("/foo");
        fireEvent.focus(anchor.parentElement!);
        expect(screen.getByLabelText("http://localhost/foo")).toBe(anchor.parentElement!);
    });
});
