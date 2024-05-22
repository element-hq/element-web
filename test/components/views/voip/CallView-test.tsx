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
import { zip } from "lodash";
import { render, screen, act, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { mocked, Mocked } from "jest-mock";
import { MatrixClient, PendingEventOrdering, Room, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { Widget } from "matrix-widget-api";

import type { RoomMember } from "matrix-js-sdk/src/matrix";
import type { ClientWidgetApi } from "matrix-widget-api";
import {
    stubClient,
    mkRoomMember,
    wrapInMatrixClientContext,
    useMockedCalls,
    MockedCall,
    setupAsyncStoreWithClient,
    useMockMediaDevices,
} from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { CallView as _CallView } from "../../../../src/components/views/voip/CallView";
import { WidgetMessagingStore } from "../../../../src/stores/widgets/WidgetMessagingStore";
import { CallStore } from "../../../../src/stores/CallStore";
import { Call, ConnectionState } from "../../../../src/models/Call";

const CallView = wrapInMatrixClientContext(_CallView);

describe("CallView", () => {
    useMockedCalls();
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;

    beforeEach(() => {
        useMockMediaDevices();

        stubClient();
        client = mocked(MatrixClientPeg.safeGet());

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        alice = mkRoomMember(room.roomId, "@alice:example.org");
        jest.spyOn(room, "getMember").mockImplementation((userId) => (userId === alice.userId ? alice : null));

        client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        setupAsyncStoreWithClient(CallStore.instance, client);
        setupAsyncStoreWithClient(WidgetMessagingStore.instance, client);
    });

    afterEach(() => {
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
    });

    const renderView = async (skipLobby = false): Promise<void> => {
        render(<CallView room={room} resizing={false} waitForCall={false} skipLobby={skipLobby} />);
        await act(() => Promise.resolve()); // Let effects settle
    };

    describe("with an existing call", () => {
        let call: MockedCall;
        let widget: Widget;

        beforeEach(() => {
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
            cleanup(); // Unmount before we do any cleanup that might update the component
            call.destroy();
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        });

        it("calls clean on mount", async () => {
            const cleanSpy = jest.spyOn(call, "clean");
            await renderView();
            expect(cleanSpy).toHaveBeenCalled();
        });

        /**
         * TODO: Fix I do not understand this test
         */
        it.skip("tracks participants", async () => {
            const bob = mkRoomMember(room.roomId, "@bob:example.org");
            const carol = mkRoomMember(room.roomId, "@carol:example.org");

            const expectAvatars = (userIds: string[]) => {
                const avatars = screen.queryAllByRole("button", { name: "Profile picture" });
                expect(userIds.length).toBe(avatars.length);

                for (const [userId, avatar] of zip(userIds, avatars)) {
                    fireEvent.focus(avatar!);
                    screen.getAllByRole("tooltip", { name: userId });
                }
            };

            await renderView();
            expect(screen.queryByLabelText(/joined/)).toBe(null);
            expectAvatars([]);

            act(() => {
                call.participants = new Map([[alice, new Set(["a"])]]);
            });
            screen.getByText("1 person joined");
            expectAvatars([alice.userId]);

            act(() => {
                call.participants = new Map([
                    [alice, new Set(["a"])],
                    [bob, new Set(["b1", "b2"])],
                    [carol, new Set(["c"])],
                ]);
            });
            screen.getByText("4 people joined");
            expectAvatars([alice.userId, bob.userId, bob.userId, carol.userId]);

            act(() => {
                call.participants = new Map();
            });
            expect(screen.queryByLabelText(/joined/)).toBe(null);
            expectAvatars([]);
        });

        it("automatically connects to the call when skipLobby is true", async () => {
            const connectSpy = jest.spyOn(call, "start");
            await renderView(true);
            await waitFor(() => expect(connectSpy).toHaveBeenCalled(), { interval: 1 });
        });
    });

    describe("without an existing call", () => {
        it("creates and connects to a new call when the join button is pressed", async () => {
            expect(Call.get(room)).toBeNull();
            await renderView(true);
            await waitFor(() => expect(CallStore.instance.getCall(room.roomId)).not.toBeNull());
            const call = CallStore.instance.getCall(room.roomId)!;

            const widget = new Widget(call.widget);
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, {
                stop: () => {},
            } as unknown as ClientWidgetApi);
            await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Connected));

            cleanup(); // Unmount before we do any cleanup that might update the component
            call.destroy();
            WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        });
    });
});
