/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@test-utils";
import { describe, it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";

import { MINIMISED_SECTION_VISIBLE_COUNT, RoomListSectionResizer } from "./RoomListSectionResizer";

const ITEM_HEIGHT = 52;

function renderResizer(props: Partial<React.ComponentProps<typeof RoomListSectionResizer>> = {}): {
    onResize: ReturnType<typeof vi.fn>;
    handle: HTMLElement;
    unmount: () => void;
} {
    const onResize = vi.fn();
    const { unmount } = render(
        <RoomListSectionResizer
            sectionId="favourites"
            visibleCount={10}
            totalCount={10}
            itemHeight={ITEM_HEIGHT}
            onResize={onResize}
            {...props}
        />,
    );
    return { onResize, handle: screen.getByTestId("section-resizer"), unmount };
}

function pointerMove(clientY: number): void {
    window.dispatchEvent(new PointerEvent("pointermove", { clientY, bubbles: true }));
}

function pointerUp(): void {
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
}

describe("<RoomListSectionResizer />", () => {
    afterEach(() => {
        // A test may end mid-drag; make sure no body styles leak between tests.
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    });

    it("shrinks the section one room per item height when dragging up", () => {
        const { onResize, handle } = renderResizer();

        fireEvent.pointerDown(handle, { button: 0, clientY: 400 });
        expect(document.body.style.cursor).toBe("ns-resize");

        pointerMove(400 - 2 * ITEM_HEIGHT);
        expect(onResize).toHaveBeenLastCalledWith("favourites", 8);

        pointerMove(400 - 5 * ITEM_HEIGHT);
        expect(onResize).toHaveBeenLastCalledWith("favourites", 5);

        pointerUp();
        expect(document.body.style.cursor).toBe("");

        // Released: further moves change nothing.
        onResize.mockClear();
        pointerMove(100);
        expect(onResize).not.toHaveBeenCalled();
    });

    it("clamps the drag to at least one room and reports show-all past the total", () => {
        const { onResize, handle } = renderResizer({ visibleCount: 3, totalCount: 5 });

        fireEvent.pointerDown(handle, { button: 0, clientY: 400 });

        // Well past the top room (but still inside the viewport): clamped to a single room.
        pointerMove(0);
        expect(onResize).toHaveBeenLastCalledWith("favourites", 1);

        // Past the section's total: everything is shown, reported as undefined (no limit).
        pointerMove(400 + 2 * ITEM_HEIGHT);
        expect(onResize).toHaveBeenLastCalledWith("favourites", undefined);
        pointerUp();
    });

    it("keeps resizing at the last speed when the pointer leaves the viewport", async () => {
        const { onResize, handle } = renderResizer();

        fireEvent.pointerDown(handle, { button: 0, clientY: 400 });
        // Establish an upward velocity with a couple of spaced-out samples.
        for (let i = 1; i <= 3; i++) {
            await new Promise((resolve) => setTimeout(resolve, 20));
            pointerMove(400 - i * 40);
        }
        // Exit through the top of the viewport: the resize keeps going at the same
        // speed and eventually hits the one-room clamp.
        pointerMove(-10);
        await waitFor(() => expect(onResize).toHaveBeenLastCalledWith("favourites", 1));
        pointerUp();
    });

    it("cleans up an in-progress drag when unmounted", () => {
        const { onResize, handle, unmount } = renderResizer();

        fireEvent.pointerDown(handle, { button: 0, clientY: 400 });
        expect(document.body.style.cursor).toBe("ns-resize");

        unmount();
        expect(document.body.style.cursor).toBe("");

        onResize.mockClear();
        pointerMove(100);
        expect(onResize).not.toHaveBeenCalled();
    });

    // The resizer is deliberately aria-hidden (a pointer-only affordance), so the buttons are
    // found by their aria-label attribute rather than by accessible name.
    it("shows a maximise button when the section is shrunken", async () => {
        const user = userEvent.setup();
        const { onResize, handle } = renderResizer({ visibleCount: 5 });

        const button = handle.querySelector<HTMLButtonElement>('[aria-label="Show all"]')!;
        expect(button).not.toBeNull();
        await user.click(button);
        expect(onResize).toHaveBeenCalledWith("favourites", undefined);
    });

    it("shows a minimise button when the section is fully shown", async () => {
        const user = userEvent.setup();
        const { onResize, handle } = renderResizer();

        const button = handle.querySelector<HTMLButtonElement>('[aria-label="Show fewer"]')!;
        expect(button).not.toBeNull();
        await user.click(button);
        expect(onResize).toHaveBeenCalledWith("favourites", MINIMISED_SECTION_VISIBLE_COUNT);
    });

    it("shows no button when a full section is too small to minimise", () => {
        const { handle } = renderResizer({ visibleCount: 4, totalCount: 4 });
        expect(handle.querySelector("button")).toBeNull();
    });
});
