/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { render } from "@testing-library/react";
import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import React from "react";

import AddExistingToSpaceDialog from "../../../../src/components/views/dialogs/AddExistingToSpaceDialog";
import SettingsStore from "../../../../src/settings/SettingsStore";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { mkSpace, stubClient } from "../../../test-utils";

describe("<AddExistingToSpaceDialog />", () => {
    it("looks as expected", () => {
        const client = stubClient();
        const dialog = renderAddExistingToSpaceDialog(client);
        expect(dialog.asFragment()).toMatchSnapshot();
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
