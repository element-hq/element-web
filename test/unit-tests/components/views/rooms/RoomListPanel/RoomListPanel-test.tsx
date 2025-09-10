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

import { RoomListPanel } from "../../../../../../src/components/views/rooms/RoomListPanel";
import { shouldShowComponent } from "../../../../../../src/customisations/helpers/UIComponents";
import { MetaSpace } from "../../../../../../src/stores/spaces";
import { LandmarkNavigation } from "../../../../../../src/accessibility/LandmarkNavigation";

jest.mock("../../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

jest.mock("../../../../../../src/accessibility/LandmarkNavigation", () => ({
    LandmarkNavigation: {
        findAndFocusNextLandmark: jest.fn(),
    },
    Landmark: {
        ROOM_SEARCH: "something",
    },
}));

describe("<RoomListPanel />", () => {
    function renderComponent() {
        return render(<RoomListPanel activeSpace={MetaSpace.Home} />);
    }

    beforeEach(() => {
        // By default, we consider shouldShowComponent(UIComponent.FilterContainer) should return true
        mocked(shouldShowComponent).mockReturnValue(true);
    });

    it("should render the RoomListSearch component when UIComponent.FilterContainer is at true", () => {
        renderComponent();
        expect(screen.getByRole("button", { name: "Search Ctrl K" })).toBeInTheDocument();
    });

    it("should not render the RoomListSearch component when UIComponent.FilterContainer is at false", () => {
        mocked(shouldShowComponent).mockReturnValue(false);
        renderComponent();
        expect(screen.queryByRole("button", { name: "Search Ctrl K" })).toBeNull();
    });

    it("should move to the next landmark when the shortcut key is pressed", async () => {
        renderComponent();

        const userEv = userEvent.setup();

        screen.getByRole("navigation", { name: "Room list" }).focus();
        await userEv.keyboard("{Control>}{F6}{/Control}");

        expect(LandmarkNavigation.findAndFocusNextLandmark).toHaveBeenCalled();
    });
});
