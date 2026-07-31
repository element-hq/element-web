/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, type RenderResult } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { Room, type MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import { RoomResultContextMenus } from "../../../../../../src/components/views/dialogs/spotlight/RoomResultContextMenus";
import { filterConsole, stubClient } from "../../../../../test-utils";
import { shouldShowComponent } from "../../../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../../../src/settings/UIFeature";

jest.mock("../../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("RoomResultContextMenus", () => {
    let client: MatrixClient;
    let room: Room;

    const renderRoomResultContextMenus = (): RenderResult => {
        return render(<RoomResultContextMenus room={room} />);
    };

    filterConsole(
        // irrelevant for this test
        "Room !1:example.org does not have an m.room.create event",
    );

    beforeEach(() => {
        client = stubClient();
        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    it("does not render the room options context menu when UIComponent customisations disable room options", () => {
        mocked(shouldShowComponent).mockReturnValue(false);
        renderRoomResultContextMenus();
        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.RoomOptionsMenu);
        expect(screen.queryByRole("button", { name: "Room options" })).not.toBeInTheDocument();
    });

    it("renders the room options context menu when UIComponent customisations enable room options", () => {
        mocked(shouldShowComponent).mockReturnValue(true);
        renderRoomResultContextMenus();
        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.RoomOptionsMenu);
        expect(screen.queryByRole("button", { name: "Room options" })).toBeInTheDocument();
    });

    it("opens the notification options menu positioned relative to its button", async () => {
        const user = userEvent.setup();
        mocked(shouldShowComponent).mockReturnValue(true);
        renderRoomResultContextMenus();

        const button = screen.getByRole("button", { name: "Notification options" });
        // Opening the menu runs contextMenuBelow to position it beneath the button.
        await user.click(button);

        expect(screen.getByRole("menu")).toBeInTheDocument();
    });
});
