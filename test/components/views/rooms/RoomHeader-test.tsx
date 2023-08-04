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
import { Room, EventType, MatrixEvent, PendingEventOrdering } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import { stubClient } from "../../../test-utils";
import RoomHeader from "../../../../src/components/views/rooms/RoomHeader";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";

describe("Roomeader", () => {
    let room: Room;

    const ROOM_ID = "!1:example.org";

    let setCardSpy: jest.SpyInstance | undefined;

    beforeEach(async () => {
        stubClient();
        room = new Room(ROOM_ID, MatrixClientPeg.get()!, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        DMRoomMap.setShared({
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap);

        setCardSpy = jest.spyOn(RightPanelStore.instance, "setCard");
    });

    it("renders the room header", () => {
        const { container } = render(<RoomHeader room={room} />);
        expect(container).toHaveTextContent(ROOM_ID);
    });

    it("renders the room topic", async () => {
        const TOPIC = "Hello World!";

        const roomTopic = new MatrixEvent({
            type: EventType.RoomTopic,
            event_id: "$00002",
            room_id: room.roomId,
            sender: "@alice:example.com",
            origin_server_ts: 1,
            content: { topic: TOPIC },
            state_key: "",
        });
        await room.addLiveEvents([roomTopic]);

        const { container } = render(<RoomHeader room={room} />);
        expect(container).toHaveTextContent(TOPIC);
    });

    it("opens the room summary", async () => {
        const { container } = render(<RoomHeader room={room} />);

        await userEvent.click(container.firstChild! as Element);
        expect(setCardSpy).toHaveBeenCalledWith({ phase: RightPanelPhases.RoomSummary });
    });
});
