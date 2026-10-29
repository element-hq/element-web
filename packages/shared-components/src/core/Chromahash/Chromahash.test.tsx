/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import { render } from "@test-utils";
import { describe, expect, it } from "vitest";

import { Chromahash } from "./Chromahash";

// An 8x6 image encoded at the default tier, which decodes to 32x24
const HASH = "CI3MoG9AmAnNGYkQqiba5W6aHRHekEwBslZsOUoyR04";

describe("Chromahash", () => {
    it("draws the decoded hash onto a canvas at its natural size", () => {
        const { container } = render(<Chromahash className="placeholder" hash={HASH} width={320} height={240} />);

        const wrapper = container.firstElementChild as HTMLDivElement;
        expect(wrapper).toHaveClass("placeholder");
        expect(wrapper.style.width).toBe("320px");
        expect(wrapper.style.height).toBe("240px");

        const canvas = wrapper.querySelector("canvas")!;
        expect(canvas.width).toBe(32);
        expect(canvas.height).toBe(24);
        const pixel = canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data;
        expect(pixel[3]).toBe(255);
    });

    it("stretches the canvas to the given size rather than keeping the hash's aspect ratio", () => {
        // 4:1, disagreeing with the 4:3 aspect ratio embedded in the hash
        const { container } = render(<Chromahash hash={HASH} width={320} height={80} />);

        const { width, height } = container.querySelector("canvas")!.getBoundingClientRect();
        expect(width).toBe(320);
        expect(height).toBe(80);
    });

    it.each([
        ["invalid base64", "!!!"],
        ["a truncated hash", HASH.slice(0, 20)],
    ])("renders an empty placeholder for %s", (_name, hash) => {
        const { container } = render(<Chromahash hash={hash} width={320} height={240} />);

        expect(container.firstElementChild).toBeInTheDocument();
        expect(container.querySelector("canvas")).toBeNull();
    });
});
