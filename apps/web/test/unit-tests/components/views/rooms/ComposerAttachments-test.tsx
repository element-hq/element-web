/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { act, fireEvent, render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import type { MockedObject } from "jest-mock";
import { ComposerAttachments } from "../../../../../src/components/views/rooms/ComposerAttachments";
import { RoomUploadContext, RoomUploadViewModel } from "../../../../../src/viewmodels/room/RoomUploadViewModel";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { MatrixDispatcher } from "../../../../../src/dispatcher/dispatcher";
import { mkStubRoom, stubClient } from "../../../../test-utils";

// Card width plus the gap between cards.
const SLOT = 192;

/**
 * jsdom implements no PointerEvent, so fireEvent.pointerDown drops button/clientX/pointerId
 * entirely. Build the event by hand instead so the handlers see what a browser would send.
 */
function firePointer(element: Element, type: string, props: Record<string, number>): void {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, props);
    fireEvent(element, event);
}

describe("ComposerAttachments", () => {
    let vm: RoomUploadViewModel;

    beforeEach(() => {
        const client = stubClient() as MockedObject<MatrixClient>;
        const room = mkStubRoom("!room", undefined, undefined) as MockedObject<Room>;
        vm = new RoomUploadViewModel(
            room,
            client,
            TimelineRenderingType.Room,
            new MatrixDispatcher(),
            undefined,
            undefined,
            () => {},
        );
    });

    function renderTray(): void {
        render(
            <RoomUploadContext.Provider value={vm}>
                <ComposerAttachments />
            </RoomUploadContext.Provider>,
        );
    }

    it("renders nothing when no files are staged", () => {
        const { container } = render(
            <RoomUploadContext.Provider value={vm}>
                <ComposerAttachments />
            </RoomUploadContext.Provider>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("shows a card per staged file", () => {
        act(() =>
            vm.stageFiles([
                { name: "cat.png", size: 1024, type: "image/png" } as File,
                { name: "notes.pdf", size: 2048, type: "application/pdf" } as File,
            ]),
        );
        renderTray();

        expect(screen.getByText("cat.png")).toBeInTheDocument();
        expect(screen.getByText("notes.pdf")).toBeInTheDocument();
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("removes a file when its delete button is clicked", async () => {
        act(() =>
            vm.stageFiles([
                { name: "cat.png", size: 1024, type: "image/png" } as File,
                { name: "dog.png", size: 1024, type: "image/png" } as File,
            ]),
        );
        renderTray();

        await userEvent.click(screen.getAllByRole("button", { name: "Remove attachment" })[0]);

        expect(screen.queryByText("cat.png")).not.toBeInTheDocument();
        expect(screen.getByText("dog.png")).toBeInTheDocument();
        expect(vm.getSnapshot().attachments).toHaveLength(1);
    });

    it("keeps the delete button visible without hovering", () => {
        act(() => vm.stageFiles([{ name: "cat.png", size: 1024, type: "image/png" } as File]));
        renderTray();

        expect(screen.getByRole("button", { name: "Remove attachment" })).toBeVisible();
    });

    /** jsdom lays nothing out, so give the cards a believable 180px-wide row. */
    function stubLayout(): HTMLElement[] {
        const items = screen.getAllByRole("listitem");
        items.forEach((item, index) => {
            Object.defineProperty(item, "offsetLeft", { value: index * SLOT, configurable: true });
            // Not implemented by jsdom, and the component captures the pointer on drag.
            item.setPointerCapture = jest.fn();
        });
        return items;
    }

    function stageTwo(): void {
        act(() =>
            vm.stageFiles([
                { name: "first.png", size: 1024, type: "image/png" } as File,
                { name: "second.png", size: 1024, type: "image/png" } as File,
            ]),
        );
    }

    it("reorders when a card is dragged past its neighbour", () => {
        stageTwo();
        renderTray();
        const [first] = stubLayout();

        firePointer(first, "pointerdown", { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
        firePointer(first, "pointermove", { pointerId: 1, clientX: SLOT, clientY: 0 });
        firePointer(first, "pointerup", { pointerId: 1, clientX: SLOT, clientY: 0 });

        expect(vm.getSnapshot().attachments.map((a) => a.name)).toEqual(["second.png", "first.png"]);
    });

    it("eases the released card from where it was let go to its new slot", () => {
        stageTwo();
        renderTray();
        const [first] = stubLayout();

        firePointer(first, "pointerdown", { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
        // Past the midpoint, so it takes the next slot, but stops half a slot short of it.
        firePointer(first, "pointermove", { pointerId: 1, clientX: SLOT / 2, clientY: 6 });
        firePointer(first, "pointerup", { pointerId: 1, clientX: SLOT / 2, clientY: 6 });

        expect(vm.getSnapshot().attachments.map((a) => a.name)).toEqual(["second.png", "first.png"]);
        // Pinned where the pointer left it, ready to transition the rest of the way.
        expect(first.style.transform).toEqual(`translate(${-SLOT / 2}px, 6px)`);
        expect(first.style.transition).not.toContain("transform");
        expect(first.style.transition).toContain("box-shadow");
    });

    it("does not animate the cards that were only shuffled aside", () => {
        stageTwo();
        renderTray();
        const [first, second] = stubLayout();

        firePointer(first, "pointerdown", { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
        firePointer(first, "pointermove", { pointerId: 1, clientX: SLOT, clientY: 0 });
        firePointer(first, "pointerup", { pointerId: 1, clientX: SLOT, clientY: 0 });

        // The reorder already put it where its transform was showing it, so animating the
        // transform would fling it across the row.
        expect(second.style.transition).not.toContain("transform");
        expect(second.style.transform).toEqual("");
    });

    it("keeps a dragged card within the row", () => {
        stageTwo();
        renderTray();
        const [first] = stubLayout();

        firePointer(first, "pointerdown", { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
        // Yanked far past the end of the row and well below it.
        firePointer(first, "pointermove", { pointerId: 1, clientX: SLOT * 20, clientY: 500 });

        // Clamped to the last slot horizontally, and to a slight lift vertically.
        expect(first.style.transform).toEqual(`translate(${SLOT}px, 10px)`);
    });

    it("leaves the order alone when the card is not dragged far enough", () => {
        stageTwo();
        renderTray();
        const [first] = stubLayout();

        firePointer(first, "pointerdown", { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
        // A third of a slot is not past the midpoint.
        firePointer(first, "pointermove", { pointerId: 1, clientX: SLOT / 3, clientY: 0 });
        firePointer(first, "pointerup", { pointerId: 1, clientX: SLOT / 3, clientY: 0 });

        expect(vm.getSnapshot().attachments.map((a) => a.name)).toEqual(["first.png", "second.png"]);
    });

    it("does not start a drag from the delete button", () => {
        stageTwo();
        renderTray();
        stubLayout();

        const deleteButton = screen.getAllByRole("button", { name: "Remove attachment" })[0];
        firePointer(deleteButton, "pointerdown", { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
        firePointer(deleteButton, "pointermove", { pointerId: 1, clientX: SLOT, clientY: 0 });
        firePointer(deleteButton, "pointerup", { pointerId: 1, clientX: SLOT, clientY: 0 });

        expect(vm.getSnapshot().attachments.map((a) => a.name)).toEqual(["first.png", "second.png"]);
    });

    it("reorders with the arrow keys", () => {
        stageTwo();
        renderTray();
        const [first] = stubLayout();

        fireEvent.keyDown(first, { key: "ArrowRight" });

        expect(vm.getSnapshot().attachments.map((a) => a.name)).toEqual(["second.png", "first.png"]);
    });

    it("does not move the first card further left", () => {
        stageTwo();
        renderTray();
        const [first] = stubLayout();

        fireEvent.keyDown(first, { key: "ArrowLeft" });

        expect(vm.getSnapshot().attachments.map((a) => a.name)).toEqual(["first.png", "second.png"]);
    });
});
