/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { Room } from "matrix-js-sdk/src/matrix";

import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../test-utils";
import ManageRestrictedJoinRuleDialog from "../../../../../src/components/views/dialogs/ManageRestrictedJoinRuleDialog";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";

describe("<ManageRestrictedJoinRuleDialog />", () => {
    const userId = "@alice:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
    });
    const room = new Room("!roomId:server", mockClient, userId);
    mockClient.getRoom.mockReturnValue(room);
    DMRoomMap.makeShared(mockClient);

    const onFinished = jest.fn();
    const getComponent = (props = {}) =>
        render(<ManageRestrictedJoinRuleDialog room={room} onFinished={onFinished} {...props} />);

    it("should render empty state", () => {
        expect(getComponent().asFragment()).toMatchSnapshot();
    });

    it("should list spaces which are not parents of the room", () => {
        const space1 = new Room("!space:server", mockClient, userId);
        space1.name = "Other Space";
        jest.spyOn(SpaceStore.instance, "spacePanelSpaces", "get").mockReturnValue([space1]);

        expect(getComponent().asFragment()).toMatchSnapshot();
    });
});
