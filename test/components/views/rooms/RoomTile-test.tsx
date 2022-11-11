/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { render, screen, act } from "@testing-library/react";
import { mocked, Mocked } from "jest-mock";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { Widget } from "matrix-widget-api";

import type { ClientWidgetApi } from "matrix-widget-api";
import {
    stubClient,
    mkRoomMember,
    MockedCall,
    useMockedCalls,
    setupAsyncStoreWithClient,
} from "../../../test-utils";
import { CallStore } from "../../../../src/stores/CallStore";
import RoomTile from "../../../../src/components/views/rooms/RoomTile";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import PlatformPeg from "../../../../src/PlatformPeg";
import BasePlatform from "../../../../src/BasePlatform";
import { WidgetMessagingStore } from "../../../../src/stores/widgets/WidgetMessagingStore";

describe("RoomTile", () => {
    jest.spyOn(PlatformPeg, "get")
        .mockReturnValue({ overrideBrowserShortcuts: () => false } as unknown as BasePlatform);
    useMockedCalls();

    let client: Mocked<MatrixClient>;

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.get());
        DMRoomMap.makeShared();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("call subtitle", () => {
        let room: Room;
        let call: MockedCall;
        let widget: Widget;

        beforeEach(() => {
            room = new Room("!1:example.org", client, "@alice:example.org", {
                pendingEventOrdering: PendingEventOrdering.Detached,
            });

            client.getRoom.mockImplementation(roomId => roomId === room.roomId ? room : null);
            client.getRooms.mockReturnValue([room]);
            client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

            setupAsyncStoreWithClient(CallStore.instance, client);
            setupAsyncStoreWithClient(WidgetMessagingStore.instance, client);

            MockedCall.create(room, "1");
            call = CallStore.instance.getCall(room.roomId) as MockedCall;

            widget = new Widget(call.widget);
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, {
                stop: () => {},
            } as unknown as ClientWidgetApi);

            render(
                <RoomTile
                    room={room}
                    showMessagePreview={false}
                    isMinimized={false}
                    tag={DefaultTagID.Untagged}
                />,
            );
        });

        afterEach(() => {
            call.destroy();
            client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        });

        it("tracks connection state", async () => {
            screen.getByText("Video");

            // Insert an await point in the connection method so we can inspect
            // the intermediate connecting state
            let completeConnection: () => void;
            const connectionCompleted = new Promise<void>(resolve => completeConnection = resolve);
            jest.spyOn(call, "performConnection").mockReturnValue(connectionCompleted);

            await Promise.all([
                (async () => {
                    await screen.findByText("Joining…");
                    const joinedFound = screen.findByText("Joined");
                    completeConnection();
                    await joinedFound;
                })(),
                call.connect(),
            ]);

            await Promise.all([
                screen.findByText("Video"),
                call.disconnect(),
            ]);
        });

        it("tracks participants", () => {
            const alice = mkRoomMember(room.roomId, "@alice:example.org");
            const bob = mkRoomMember(room.roomId, "@bob:example.org");
            const carol = mkRoomMember(room.roomId, "@carol:example.org");

            expect(screen.queryByLabelText(/participant/)).toBe(null);

            act(() => { call.participants = new Set([alice]); });
            expect(screen.getByLabelText("1 participant").textContent).toBe("1");

            act(() => { call.participants = new Set([alice, bob, carol]); });
            expect(screen.getByLabelText("3 participants").textContent).toBe("3");

            act(() => { call.participants = new Set(); });
            expect(screen.queryByLabelText(/participant/)).toBe(null);
        });
    });
});
