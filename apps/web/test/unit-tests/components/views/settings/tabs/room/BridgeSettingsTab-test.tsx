/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import BridgeSettingsTab from "../../../../../../../src/components/views/settings/tabs/room/BridgeSettingsTab";
import { getMockClientWithEventEmitter, withClientContextRenderOptions } from "../../../../../../test-utils";

describe("<BridgeSettingsTab />", () => {
    const userId = "@alice:server.org";
    const client = getMockClientWithEventEmitter({
        getRoom: jest.fn(),
    });
    const roomId = "!room:server.org";

    const getComponent = (room: Room) =>
        render(<BridgeSettingsTab room={room} />, withClientContextRenderOptions(client));

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
