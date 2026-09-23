/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, afterEach, expect } from "vitest";

import * as stories from "./SectionCreationView.stories";
import { SectionCreationView } from "./SectionCreationView";
import { MockViewModel } from "../../core/viewmodel/MockViewModel";
import { type SectionCreationViewActions, type SectionCreationViewSnapshot } from "./types";

const { Default, Edition, AddRooms } = composeStories(stories);

describe("SectionCreationView", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Storybook snapshots", () => {
        it("renders the creation state", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders the edition state", () => {
            const { container } = render(<Edition />);
            expect(container).toMatchSnapshot();
        });

        it("renders the add room state", () => {
            const { container } = render(<AddRooms />);
            expect(container).toMatchSnapshot();
        });
    });

    describe("User interactions", () => {
        const createOrEditSection = vi.fn();
        const setSection = vi.fn();

        class TestViewModel extends MockViewModel<SectionCreationViewSnapshot> implements SectionCreationViewActions {
            public createOrEditSection = createOrEditSection;
            public setSection = setSection;
            public toggleRoom = vi.fn();
            public addRooms = vi.fn();
            public search = vi.fn();
            public unSelectLastRoom = vi.fn();
            public renderRoomAvatar = vi.fn();
        }

        it("updates the section value when the input is filled", async () => {
            const user = userEvent.setup();
            const vm = new TestViewModel({
                value: "",
                step: "creation",
                rooms: [],
                selectedRooms: [],
                placeholder: "Search rooms",
                listTitle: "Rooms",
                emptyListText: "No rooms found",
            });

            render(<SectionCreationView vm={vm} />);

            await user.type(screen.getByRole("textbox"), "A");
            expect(setSection).toHaveBeenCalledWith("A");
        });
    });
});
