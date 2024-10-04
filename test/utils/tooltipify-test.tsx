/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "@testing-library/react";

import { tooltipifyLinks } from "../../src/utils/tooltipify";
import PlatformPeg from "../../src/PlatformPeg";
import BasePlatform from "../../src/BasePlatform";

describe("tooltipify", () => {
    jest.spyOn(PlatformPeg, "get").mockReturnValue({ needsUrlTooltips: () => true } as unknown as BasePlatform);

    it("does nothing for empty element", () => {
        const { container: root } = render(<div />);
        const originalHtml = root.outerHTML;
        const containers: Element[] = [];
        tooltipifyLinks([root], [], containers);
        expect(containers).toHaveLength(0);
        expect(root.outerHTML).toEqual(originalHtml);
    });

    it("wraps single anchor", () => {
        const { container: root } = render(
            <div>
                <a href="/foo">click</a>
            </div>,
        );
        const containers: Element[] = [];
        tooltipifyLinks([root], [], containers);
        expect(containers).toHaveLength(1);
        const anchor = root.querySelector("a");
        expect(anchor?.getAttribute("href")).toEqual("/foo");
        const tooltip = anchor!.querySelector(".mx_TextWithTooltip_target");
        expect(tooltip).toBeDefined();
    });

    it("ignores node", () => {
        const { container: root } = render(
            <div>
                <a href="/foo">click</a>
            </div>,
        );
        const originalHtml = root.outerHTML;
        const containers: Element[] = [];
        tooltipifyLinks([root], [root.children[0]], containers);
        expect(containers).toHaveLength(0);
        expect(root.outerHTML).toEqual(originalHtml);
    });

    it("does not re-wrap if called multiple times", () => {
        const { container: root } = render(
            <div>
                <a href="/foo">click</a>
            </div>,
        );
        const containers: Element[] = [];
        tooltipifyLinks([root], [], containers);
        tooltipifyLinks([root], [], containers);
        tooltipifyLinks([root], [], containers);
        tooltipifyLinks([root], [], containers);
        expect(containers).toHaveLength(1);
        const anchor = root.querySelector("a");
        expect(anchor?.getAttribute("href")).toEqual("/foo");
        const tooltip = anchor!.querySelector(".mx_TextWithTooltip_target");
        expect(tooltip).toBeDefined();
    });
});
