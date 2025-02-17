/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import { RoomListSearch } from "../../../../../../src/components/views/rooms/RoomListView/RoomListSearch";
import { MetaSpace } from "../../../../../../src/stores/spaces";
import { shouldShowComponent } from "../../../../../../src/customisations/helpers/UIComponents";
import defaultDispatcher from "../../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../../src/dispatcher/actions";

jest.mock("../../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("<RoomListSearch />", () => {
    function renderComponent(activeSpace = MetaSpace.Home) {
        return render(<RoomListSearch activeSpace={activeSpace} />);
    }

    beforeEach(() => {
        // By default, we consider shouldShowComponent(UIComponent.ExploreRooms) should return true
        mocked(shouldShowComponent).mockReturnValue(true);
    });

    it("should display all the buttons", () => {
        const { asFragment } = renderComponent();

        // The search and explore buttons should be displayed
        expect(screen.getByRole("button", { name: "Search Ctrl K" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Explore rooms" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should hide the explore button when the active space is not MetaSpace.Home", () => {
        const { asFragment } = renderComponent(MetaSpace.VideoRooms);

        // The search button should be displayed but not the explore button
        expect(screen.getByRole("button", { name: "Search Ctrl K" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Explore rooms" })).not.toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should hide the explore button when UIComponent.ExploreRooms is disabled", () => {
        mocked(shouldShowComponent).mockReturnValue(false);
        const { asFragment } = renderComponent();

        // The search button should be displayed but not the explore button
        expect(screen.getByRole("button", { name: "Search Ctrl K" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Explore rooms" })).not.toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should open the spotlight when the search button is clicked", async () => {
        const fireSpy = jest.spyOn(defaultDispatcher, "fire");
        const user = userEvent.setup();
        renderComponent();

        // Click on the search button
        await user.click(screen.getByRole("button", { name: "Search Ctrl K" }));

        // The spotlight should be opened
        expect(fireSpy).toHaveBeenCalledWith(Action.OpenSpotlight);
    });

    it("should open the room directory when the explore button is clicked", async () => {
        const fireSpy = jest.spyOn(defaultDispatcher, "fire");
        const user = userEvent.setup();
        renderComponent();

        // Click on the search button
        await user.click(screen.getByRole("button", { name: "Explore rooms" }));

        // The spotlight should be opened
        expect(fireSpy).toHaveBeenCalledWith(Action.ViewRoomDirectory);
    });
});
