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
import { render, screen, act, RenderResult } from "@testing-library/react";
import { mocked, Mocked } from "jest-mock";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { Widget } from "matrix-widget-api";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import type { ClientWidgetApi } from "matrix-widget-api";
import {
    stubClient,
    mkRoomMember,
    MockedCall,
    useMockedCalls,
    setupAsyncStoreWithClient,
    filterConsole,
} from "../../../test-utils";
import { CallStore } from "../../../../src/stores/CallStore";
import RoomTile from "../../../../src/components/views/rooms/RoomTile";
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import PlatformPeg from "../../../../src/PlatformPeg";
import BasePlatform from "../../../../src/BasePlatform";
import { WidgetMessagingStore } from "../../../../src/stores/widgets/WidgetMessagingStore";
import { VoiceBroadcastInfoState } from "../../../../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "../../../voice-broadcast/utils/test-utils";

describe("RoomTile", () => {
    jest.spyOn(PlatformPeg, "get").mockReturnValue({
        overrideBrowserShortcuts: () => false,
    } as unknown as BasePlatform);
    useMockedCalls();

    const setUpVoiceBroadcast = (state: VoiceBroadcastInfoState): void => {
        voiceBroadcastInfoEvent = mkVoiceBroadcastInfoStateEvent(
            room.roomId,
            state,
            client.getUserId(),
            client.getDeviceId(),
        );

        act(() => {
            room.currentState.setStateEvents([voiceBroadcastInfoEvent]);
        });
    };

    const renderRoomTile = (): void => {
        renderResult = render(
            <RoomTile room={room} showMessagePreview={false} isMinimized={false} tag={DefaultTagID.Untagged} />,
        );
    };

    let client: Mocked<MatrixClient>;
    let restoreConsole: () => void;
    let voiceBroadcastInfoEvent: MatrixEvent;
    let room: Room;
    let renderResult: RenderResult;

    beforeEach(() => {
        restoreConsole = filterConsole(
            // irrelevant for this test
            "Room !1:example.org does not have an m.room.create event",
        );

        stubClient();
        client = mocked(MatrixClientPeg.get());
        DMRoomMap.makeShared();

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        renderRoomTile();
    });

    afterEach(() => {
        restoreConsole();
        jest.clearAllMocks();
    });

    it("should render the room", () => {
        expect(renderResult.container).toMatchSnapshot();
    });

    describe("when a call starts", () => {
        let call: MockedCall;
        let widget: Widget;

        beforeEach(() => {
            setupAsyncStoreWithClient(CallStore.instance, client);
            setupAsyncStoreWithClient(WidgetMessagingStore.instance, client);

            MockedCall.create(room, "1");
            const maybeCall = CallStore.instance.getCall(room.roomId);
            if (!(maybeCall instanceof MockedCall)) throw new Error("Failed to create call");
            call = maybeCall;

            widget = new Widget(call.widget);
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, {
                stop: () => {},
            } as unknown as ClientWidgetApi);
        });

        afterEach(() => {
            renderResult.unmount();
            call.destroy();
            client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        });

        it("tracks connection state", async () => {
            screen.getByText("Video");

            // Insert an await point in the connection method so we can inspect
            // the intermediate connecting state
            let completeConnection: () => void;
            const connectionCompleted = new Promise<void>((resolve) => (completeConnection = resolve));
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

            await Promise.all([screen.findByText("Video"), call.disconnect()]);
        });

        it("tracks participants", () => {
            const alice: [RoomMember, Set<string>] = [mkRoomMember(room.roomId, "@alice:example.org"), new Set(["a"])];
            const bob: [RoomMember, Set<string>] = [
                mkRoomMember(room.roomId, "@bob:example.org"),
                new Set(["b1", "b2"]),
            ];
            const carol: [RoomMember, Set<string>] = [mkRoomMember(room.roomId, "@carol:example.org"), new Set(["c"])];

            expect(screen.queryByLabelText(/participant/)).toBe(null);

            act(() => {
                call.participants = new Map([alice]);
            });
            expect(screen.getByLabelText("1 participant").textContent).toBe("1");

            act(() => {
                call.participants = new Map([alice, bob, carol]);
            });
            expect(screen.getByLabelText("4 participants").textContent).toBe("4");

            act(() => {
                call.participants = new Map();
            });
            expect(screen.queryByLabelText(/participant/)).toBe(null);
        });

        describe("and a live broadcast starts", () => {
            beforeEach(() => {
                setUpVoiceBroadcast(VoiceBroadcastInfoState.Started);
            });

            it("should still render the call subtitle", () => {
                expect(screen.queryByText("Video")).toBeInTheDocument();
                expect(screen.queryByText("Live")).not.toBeInTheDocument();
            });
        });
    });

    describe("when a live voice broadcast starts", () => {
        beforeEach(() => {
            setUpVoiceBroadcast(VoiceBroadcastInfoState.Started);
        });

        it("should render the »Live« subtitle", () => {
            expect(screen.queryByText("Live")).toBeInTheDocument();
        });

        describe("and the broadcast stops", () => {
            beforeEach(() => {
                const stopEvent = mkVoiceBroadcastInfoStateEvent(
                    room.roomId,
                    VoiceBroadcastInfoState.Stopped,
                    client.getUserId(),
                    client.getDeviceId(),
                    voiceBroadcastInfoEvent,
                );
                act(() => {
                    room.currentState.setStateEvents([stopEvent]);
                });
            });

            it("should not render the »Live« subtitle", () => {
                expect(screen.queryByText("Live")).not.toBeInTheDocument();
            });
        });
    });
});
