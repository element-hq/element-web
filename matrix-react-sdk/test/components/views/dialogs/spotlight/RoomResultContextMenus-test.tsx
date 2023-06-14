/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { render, screen, RenderResult } from "@testing-library/react";
import { mocked } from "jest-mock";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";

import { RoomResultContextMenus } from "../../../../../src/components/views/dialogs/spotlight/RoomResultContextMenus";
import { filterConsole, stubClient } from "../../../../test-utils";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../../src/settings/UIFeature";

jest.mock("../../../../../src/customisations/helpers/UIComponents", () => ({
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
});
