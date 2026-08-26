/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "test-utils-rtl";
import { clientAndSDKContextRenderOptions, createTestClient, TestSDKContext } from "test-utils";
import userEvent from "@testing-library/user-event";

import { RoomListPanel } from "./RoomListPanel";
import { shouldShowComponent } from "../../../../customisations/helpers/UIComponents";
import { MetaSpace } from "../../../../stores/spaces";
import { LandmarkNavigation } from "../../../../accessibility/LandmarkNavigation";
import { ReleaseAnnouncementStore } from "../../../../stores/ReleaseAnnouncementStore";

vi.mock("../../../../customisations/helpers/UIComponents", () => ({
    shouldShowComponent: vi.fn(),
}));

vi.mock("../../../../accessibility/LandmarkNavigation", () => ({
    LandmarkNavigation: {
        findAndFocusNextLandmark: vi.fn(),
    },
    Landmark: {
        ROOM_SEARCH: "something",
    },
}));

// mock out release announcements as they interfere with what's focused
// (this can be removed once the new room list announcement is gone)
vi.spyOn(ReleaseAnnouncementStore.instance, "getReleaseAnnouncement").mockReturnValue(null);

describe("<RoomListPanel />", () => {
    const client = createTestClient();
    const sdkContext = new TestSDKContext();
    sdkContext._client = client;

    function renderComponent() {
        return render(
            <RoomListPanel activeSpace={MetaSpace.Home} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();

        // By default, we consider shouldShowComponent(UIComponent.FilterContainer) should return true
        vi.mocked(shouldShowComponent).mockReturnValue(true);
    });

    it("should render the RoomListSearch component when UIComponent.FilterContainer is at true", () => {
        renderComponent();
        expect(screen.getByRole("button", { name: "Search Ctrl K" })).toBeInTheDocument();
    });

    it("should not render the RoomListSearch component when UIComponent.FilterContainer is at false", () => {
        vi.mocked(shouldShowComponent).mockReturnValue(false);
        renderComponent();
        expect(screen.queryByRole("button", { name: "Search Ctrl K" })).toBeNull();
    });

    it("should move to the next landmark when the shortcut key is pressed", async () => {
        renderComponent();

        const userEv = userEvent.setup();

        // Pick something arbitrary and focusable in the room list component and focus it
        const exploreRooms = screen.getByRole("button", { name: "Explore rooms" });
        exploreRooms.focus();
        expect(exploreRooms).toHaveFocus();

        screen.getByRole("navigation", { name: "Room list" }).focus();
        await userEv.keyboard("{Control>}{F6}{/Control}");

        expect(LandmarkNavigation.findAndFocusNextLandmark).toHaveBeenCalled();
    });

    it("should not move to the next landmark if room list loses focus", async () => {
        renderComponent();

        const userEv = userEvent.setup();

        // Pick something arbitrary and focusable in the room list component and focus it
        const exploreRooms = screen.getByRole("button", { name: "Explore rooms" });
        exploreRooms.focus();
        expect(exploreRooms).toHaveFocus();

        exploreRooms.blur();
        expect(exploreRooms).not.toHaveFocus();

        await userEv.keyboard("{Control>}{F6}{/Control}");

        expect(LandmarkNavigation.findAndFocusNextLandmark).not.toHaveBeenCalled();
    });
});
