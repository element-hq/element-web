/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import React from "react";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { mkStubRoom, stubClient } from "test-utils";

import { CreateSectionDialog } from "./CreateSectionDialog";
import { SDKContextClass } from "../../../contexts/SDKContextClass";
import RoomListStoreV3 from "../../../stores/room-list-v3/RoomListStoreV3";
import DMRoomMap from "../../../utils/DMRoomMap";

const SECTION_TAG = "element.io.section.abc";

describe("CreateSectionDialog", () => {
    const onFinished = vi.fn();
    let client: MatrixClient;
    let rooms: Room[];

    afterEach(() => {
        vi.resetAllMocks();
    });

    beforeEach(() => {
        client = stubClient();
        rooms = [
            mkStubRoom("!first:example.org", "First room", client),
            mkStubRoom("!second:example.org", "Second room", client),
        ];
        rooms.forEach((room) => (room.tags = {}));
        vi.spyOn(client, "getRoom").mockImplementation(
            (roomId) => rooms.find((room) => room.roomId === roomId) ?? null,
        );
        // The dialog builds its view model from these two globals.
        vi.spyOn(SDKContextClass.instance, "client", "get").mockReturnValue(client);
        vi.spyOn(RoomListStoreV3.instance, "getRooms").mockReturnValue(rooms);
        DMRoomMap.makeShared(client);
    });

    function renderComponent(): void {
        render(<CreateSectionDialog onFinished={onFinished} />);
    }

    /**
     * Name the section and submit it, which takes the dialog to the room selection step.
     * @param name - The name to give to the section.
     */
    async function goToRoomStep(name = "My section"): Promise<void> {
        await userEvent.type(screen.getByRole("textbox"), name);
        await userEvent.click(screen.getByRole("button", { name: "Create section" }));
    }

    it("renders the dialog", () => {
        const { container } = render(<CreateSectionDialog onFinished={onFinished} />);
        expect(container).toMatchSnapshot();
    });

    it("has the create section button disabled when the input is empty", () => {
        renderComponent();
        const createButton = screen.getByRole("button", { name: "Create section" });
        expect(createButton).toBeDisabled();
    });

    it("moves to the room selection step when create section is clicked", async () => {
        renderComponent();
        await goToRoomStep();

        expect(screen.getByRole("heading", { name: "Add chats to My section" })).toBeInTheDocument();
        expect(onFinished).not.toHaveBeenCalled();
    });

    it("moves to the room selection step when the form is submitted", async () => {
        renderComponent();
        await userEvent.type(screen.getByRole("textbox"), "My section");
        await userEvent.keyboard("{Enter}");

        expect(screen.getByRole("heading", { name: "Add chats to My section" })).toBeInTheDocument();
        expect(onFinished).not.toHaveBeenCalled();
    });

    it("calls onFinished without a section when the dialog is cancelled", async () => {
        renderComponent();
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onFinished).toHaveBeenCalledWith(undefined, undefined);
    });

    it("calls onFinished with the rooms picked in the room selection step", async () => {
        renderComponent();
        await goToRoomStep();
        await userEvent.click(screen.getByRole("option", { name: /First room/ }));
        await userEvent.click(screen.getByRole("button", { name: "Add chats" }));

        expect(onFinished).toHaveBeenCalledWith("My section", ["!first:example.org"], []);
    });

    it("keeps the section but no room when the room selection step is skipped", async () => {
        renderComponent();
        await goToRoomStep();
        await userEvent.click(screen.getByRole("button", { name: "Skip" }));

        expect(onFinished).toHaveBeenCalledWith("My section", undefined);
    });

    describe("editing mode", () => {
        const sectionToEdit = { name: "Existing Section", tag: SECTION_TAG };

        function renderEditComponent(): void {
            render(<CreateSectionDialog onFinished={onFinished} sectionToEdit={sectionToEdit} />);
        }

        it("pre-fills the input with the existing section name", () => {
            renderEditComponent();
            const input = screen.getByRole("textbox");
            expect(input).toHaveValue("Existing Section");
        });

        it("shows the save button instead of create section", () => {
            renderEditComponent();
            expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Create section" })).not.toBeInTheDocument();
        });

        it("moves to the room selection step when save is clicked", async () => {
            renderEditComponent();
            const input = screen.getByRole("textbox");
            await userEvent.clear(input);
            await userEvent.type(input, "Updated Section");
            await userEvent.click(screen.getByRole("button", { name: "Save" }));

            expect(screen.getByRole("heading", { name: "Add chats to Updated Section" })).toBeInTheDocument();
            expect(onFinished).not.toHaveBeenCalled();
        });

        it("preselects the rooms of the section and reports the ones removed from it", async () => {
            // Both rooms start in the section: one is removed, the other keeps it submittable.
            rooms.forEach((room) => (room.tags = { [SECTION_TAG]: {} }));
            renderEditComponent();
            await userEvent.click(screen.getByRole("button", { name: "Save" }));

            // The room is preselected, so clicking it takes it out of the section
            await userEvent.click(screen.getByRole("option", { name: /First room/ }));
            await userEvent.click(screen.getByRole("button", { name: "Add chats" }));

            expect(onFinished).toHaveBeenCalledWith("Existing Section", [], ["!first:example.org"]);
        });

        it("has the save button disabled when the input is empty", async () => {
            renderEditComponent();
            const input = screen.getByRole("textbox");
            await userEvent.clear(input);
            expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
        });
    });
});
