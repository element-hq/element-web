/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import { render, screen, act, cleanup } from "test-utils-rtl";
import {
    type MatrixClient,
    PendingEventOrdering,
    Room,
    RoomStateEvent,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { Widget } from "matrix-widget-api";
import {
    stubClient,
    mkRoomMember,
    wrapInMatrixClientContext,
    useMockedCalls,
    MockedCall,
    setupAsyncStoreWithClient,
    useMockMediaDevices,
    clientAndSDKContextRenderOptions,
    TestSDKContext,
} from "test-utils";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { CallView as _CallView } from "./CallView";
import { WidgetMessagingStore } from "../../../stores/widgets/WidgetMessagingStore";
import { CallStore } from "../../../stores/CallStore";
import DMRoomMap from "../../../utils/DMRoomMap";
import { type WidgetMessaging } from "../../../stores/widgets/WidgetMessaging";

const CallView = wrapInMatrixClientContext(_CallView);

describe("CallView", () => {
    useMockedCalls();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let client: Mocked<MatrixClient>;
    let sdkContext: TestSDKContext;
    let room: Room;
    let alice: RoomMember;
    let call: MockedCall;
    let widget: Widget;

    beforeEach(() => {
        useMockMediaDevices();

        stubClient();
        client = vi.mocked(MatrixClientPeg.safeGet());
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
        DMRoomMap.makeShared(client);

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        alice = mkRoomMember(room.roomId, "@alice:example.org");
        vi.spyOn(room, "getMember").mockImplementation((userId) => (userId === alice.userId ? alice : null));

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
            on: () => {},
            off: () => {},
            stop: () => {},
            embedUrl: "https://example.org",
        } as unknown as WidgetMessaging);
    });

    afterEach(() => {
        cleanup(); // Unmount before we do any cleanup that might update the component
        call.destroy();
        WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
    });

    const renderView = async (role: string | undefined = undefined): Promise<void> => {
        render(
            <CallView room={room} resizing={false} role={role} onClose={() => {}} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        await act(() => Promise.resolve()); // Let effects settle
    };

    it("accepts an accessibility role", async () => {
        await renderView("main");
        expect(screen.getByRole("main")).toBeVisible();
    });

    it("calls clean on mount", async () => {
        const cleanSpy = vi.spyOn(call, "clean");
        await renderView();
        expect(cleanSpy).toHaveBeenCalled();
    });
});
