/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { render, waitFor, act } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import EmojiPicker from "../../../../../src/components/views/emojipicker/EmojiPicker";
import { stubClient } from "../../../../test-utils";

describe("EmojiPicker", function () {
    stubClient();

    it("should not mangle default order after filtering", async () => {
        const ref = createRef<EmojiPicker>();
        const { container } = render(
            <EmojiPicker ref={ref} onChoose={(str: string) => false} onFinished={jest.fn()} />,
        );

        // Record the HTML before filtering
        const beforeHtml = container.innerHTML;

        // Apply a filter and assert that the HTML has changed
        //@ts-ignore private access
        act(() => ref.current!.onChangeFilter("test"));
        expect(beforeHtml).not.toEqual(container.innerHTML);

        // Clear the filter and assert that the HTML matches what it was before filtering
        //@ts-ignore private access
        act(() => ref.current!.onChangeFilter(""));
        await waitFor(() => expect(beforeHtml).toEqual(container.innerHTML));
    });

    it("sort emojis by shortcode and size", function () {
        const ep = new EmojiPicker({ onChoose: (str: string) => false, onFinished: jest.fn() });

        //@ts-ignore private access
        act(() => ep.onChangeFilter("heart"));

        //@ts-ignore private access
        expect(ep.memoizedDataByCategory["people"][0].shortcodes[0]).toEqual("heart");
        //@ts-ignore private access
        expect(ep.memoizedDataByCategory["people"][1].shortcodes[0]).toEqual("heartbeat");
    });

    it("should allow keyboard navigation using arrow keys", async () => {
        // mock offsetParent
        Object.defineProperty(HTMLElement.prototype, "offsetParent", {
            get() {
                return this.parentNode;
            },
        });

        const onChoose = jest.fn();
        const onFinished = jest.fn();
        const { container } = render(<EmojiPicker onChoose={onChoose} onFinished={onFinished} />);

        const input = container.querySelector("input")!;
        expect(input).toHaveFocus();

        function getEmoji(): string {
            const activeDescendant = input.getAttribute("aria-activedescendant");
            return container.querySelector("#" + activeDescendant)!.textContent!;
        }

        expect(getEmoji()).toEqual("😀");
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("🙂");
        await userEvent.keyboard("[ArrowUp]");
        expect(getEmoji()).toEqual("😀");
        await userEvent.keyboard("Flag");
        await userEvent.keyboard("[ArrowRight]");
        await userEvent.keyboard("[ArrowRight]");
        expect(getEmoji()).toEqual("📫️");
        await userEvent.keyboard("[ArrowDown]");
        expect(getEmoji()).toEqual("🇦🇨");
        await userEvent.keyboard("[ArrowLeft]");
        expect(getEmoji()).toEqual("📭️");
        await userEvent.keyboard("[ArrowUp]");
        expect(getEmoji()).toEqual("⛳️");
        await userEvent.keyboard("[ArrowRight]");
        expect(getEmoji()).toEqual("📫️");
        await userEvent.keyboard("[Enter]");

        expect(onChoose).toHaveBeenCalledWith("📫️");
        expect(onFinished).toHaveBeenCalled();
    });
});
