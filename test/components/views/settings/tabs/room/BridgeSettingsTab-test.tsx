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
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import BridgeSettingsTab from "../../../../../../src/components/views/settings/tabs/room/BridgeSettingsTab";
import { getMockClientWithEventEmitter } from "../../../../../test-utils";

describe("<BridgeSettingsTab />", () => {
    const userId = "@alice:server.org";
    const client = getMockClientWithEventEmitter({
        getRoom: jest.fn(),
    });
    const roomId = "!room:server.org";

    const getComponent = (room: Room) => render(<BridgeSettingsTab room={room} />);

    it("renders when room is not bridging messages to any platform", () => {
        const room = new Room(roomId, client, userId);

        const { container } = getComponent(room);

        expect(container).toMatchSnapshot();
    });

    it("renders when room is bridging messages", () => {
        const bridgeEvent = new MatrixEvent({
            type: "uk.half-shot.bridge",
            content: {
                channel: { id: "channel-test" },
                protocol: { id: "protocol-test" },
                bridgebot: "test",
            },
            room_id: roomId,
            state_key: "1",
        });
        const room = new Room(roomId, client, userId);
        room.currentState.setStateEvents([bridgeEvent]);
        client.getRoom.mockReturnValue(room);

        const { container } = getComponent(room);

        expect(container).toMatchSnapshot();
    });
});
