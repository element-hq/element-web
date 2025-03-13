/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, act, cleanup } from "jest-matrix-react";
import { mocked, type Mocked } from "jest-mock";
import {
    type MatrixClient,
    PendingEventOrdering,
    Room,
    RoomStateEvent,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { Widget } from "matrix-widget-api";

import type { ClientWidgetApi } from "matrix-widget-api";
import {
    stubClient,
    mkRoomMember,
    wrapInMatrixClientContext,
    useMockedCalls,
    MockedCall,
    setupAsyncStoreWithClient,
    useMockMediaDevices,
} from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { CallView as _CallView } from "../../../../../src/components/views/voip/CallView";
import { WidgetMessagingStore } from "../../../../../src/stores/widgets/WidgetMessagingStore";
import { CallStore } from "../../../../../src/stores/CallStore";

const CallView = wrapInMatrixClientContext(_CallView);

describe("CallView", () => {
    useMockedCalls();
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let call: MockedCall;
    let widget: Widget;

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
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
    });

    const renderView = async (skipLobby = false, role: string | undefined = undefined): Promise<void> => {
        render(<CallView room={room} resizing={false} skipLobby={skipLobby} role={role} onClose={() => {}} />);
        await act(() => Promise.resolve()); // Let effects settle
    };

    it("accepts an accessibility role", async () => {
        await renderView(undefined, "main");
        screen.getByRole("main");
    });

    it("calls clean on mount", async () => {
        const cleanSpy = jest.spyOn(call, "clean");
        await renderView();
        expect(cleanSpy).toHaveBeenCalled();
    });

    it("updates the call's skipLobby parameter", async () => {
        await renderView(true);
        expect(call.widget.data?.skipLobby).toBe(true);
    });
});
