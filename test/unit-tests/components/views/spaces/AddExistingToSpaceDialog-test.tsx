/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import React from "react";

import AddExistingToSpaceDialog from "../../../../../src/components/views/dialogs/AddExistingToSpaceDialog";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { mkRoom, mkSpace, stubClient } from "../../../../test-utils";

describe("<AddExistingToSpaceDialog />", () => {
    beforeEach(() => {
        jest.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(600);
    });

    it("looks as expected", () => {
        const client = stubClient();
        const dialog = renderAddExistingToSpaceDialog(client);
        expect(dialog.asFragment()).toMatchSnapshot();
    });

    it("should show 'no results' if appropriate", () => {
        const client = stubClient();
        const { getByText } = renderAddExistingToSpaceDialog(client);
        expect(getByText("No results")).toBeInTheDocument();
    });

    it("should not show 'no results' if we have results to show", () => {
        const client = stubClient();
        mocked(client.getVisibleRooms).mockReturnValue([
            mkSpace(client, "!space2:example.com"),
            mkRoom(client, "!room2:example.com"),
        ]);
        const { queryByText, getByText } = renderAddExistingToSpaceDialog(client);
        expect(queryByText("No results")).not.toBeInTheDocument();
        expect(getByText("!room2:example.com")).toBeInTheDocument();
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes through the dynamic predecessor setting", async () => {
            const client = stubClient();
            mocked(client.getVisibleRooms).mockClear();
            renderAddExistingToSpaceDialog(client);
            expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            const client = stubClient();
            mocked(client.getVisibleRooms).mockClear();
            renderAddExistingToSpaceDialog(client);
            expect(client.getVisibleRooms).toHaveBeenCalledWith(true);
        });
    });
});

function renderAddExistingToSpaceDialog(client: MatrixClient) {
    const dmRoomMap = new DMRoomMap(client);
    jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
    const space = mkSpace(client, "!spaceid:example.com");
    const dialog = render(
        <AddExistingToSpaceDialog
            space={space}
            onCreateRoomClick={jest.fn()}
            onAddSubspaceClick={jest.fn()}
            onFinished={jest.fn()}
        />,
    );
    return dialog;
}
