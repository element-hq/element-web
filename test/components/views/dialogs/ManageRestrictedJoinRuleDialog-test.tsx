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

import React from "react";
import { render } from "@testing-library/react";
import { Room } from "matrix-js-sdk/src/matrix";

import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../test-utils";
import ManageRestrictedJoinRuleDialog from "../../../../src/components/views/dialogs/ManageRestrictedJoinRuleDialog";
import SpaceStore from "../../../../src/stores/spaces/SpaceStore";
import DMRoomMap from "../../../../src/utils/DMRoomMap";

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
