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
import { render, screen, act, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { mocked, Mocked } from "jest-mock";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { Widget } from "matrix-widget-api";

import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import type { ClientWidgetApi } from "matrix-widget-api";
import type { Call } from "../../../src/models/Call";
import {
    stubClient,
    mkRoomMember,
    wrapInMatrixClientContext,
    useMockedCalls,
    MockedCall,
    setupAsyncStoreWithClient,
} from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { VideoRoomView as UnwrappedVideoRoomView } from "../../../src/components/structures/VideoRoomView";
import { WidgetMessagingStore } from "../../../src/stores/widgets/WidgetMessagingStore";
import { CallStore } from "../../../src/stores/CallStore";
import { ConnectionState } from "../../../src/models/Call";

const VideoRoomView = wrapInMatrixClientContext(UnwrappedVideoRoomView);

describe("VideoRoomView", () => {
    useMockedCalls();
    Object.defineProperty(navigator, "mediaDevices", {
        value: {
            enumerateDevices: async () => [],
            getUserMedia: () => null,
        },
    });

    let client: Mocked<MatrixClient>;
    let room: Room;
    let call: Call;
    let widget: Widget;
    let alice: RoomMember;

    beforeEach(() => {
        stubClient();
        client = mocked(MatrixClientPeg.get());

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        alice = mkRoomMember(room.roomId, "@alice:example.org");
        jest.spyOn(room, "getMember").mockImplementation(userId => userId === alice.userId ? alice : null);

        client.getRoom.mockImplementation(roomId => roomId === room.roomId ? room : null);
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        setupAsyncStoreWithClient(CallStore.instance, client);
        setupAsyncStoreWithClient(WidgetMessagingStore.instance, client);

        MockedCall.create(room, "1");
        call = CallStore.instance.get(room.roomId);
        if (call === null) throw new Error("Failed to create call");

        widget = new Widget(call.widget);
        WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, {
            stop: () => {},
        } as unknown as ClientWidgetApi);
    });

    afterEach(() => {
        cleanup();
        call.destroy();
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
        WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
    });

    const renderView = async (): Promise<void> => {
        render(<VideoRoomView room={room} resizing={false} />);
        await act(() => Promise.resolve()); // Let effects settle
    };

    it("calls clean on mount", async () => {
        const cleanSpy = jest.spyOn(call, "clean");
        await renderView();
        expect(cleanSpy).toHaveBeenCalled();
    });

    it("shows lobby and keeps widget loaded when disconnected", async () => {
        await renderView();
        screen.getByRole("button", { name: "Join" });
        screen.getAllByText(/\bwidget\b/i);
    });

    it("only shows widget when connected", async () => {
        await renderView();
        fireEvent.click(screen.getByRole("button", { name: "Join" }));
        await waitFor(() => expect(call.connectionState).toBe(ConnectionState.Connected));
        expect(screen.queryByRole("button", { name: "Join" })).toBe(null);
        screen.getAllByText(/\bwidget\b/i);
    });
});
