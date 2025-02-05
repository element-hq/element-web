/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    Room,
    PendingEventOrdering,
    type MatrixClient,
    type RoomMember,
    RoomStateEvent,
} from "matrix-js-sdk/src/matrix";
import { type ClientWidgetApi, Widget } from "matrix-widget-api";
import { act, cleanup, render, screen } from "jest-matrix-react";
import { mocked, type Mocked } from "jest-mock";

import {
    mkRoomMember,
    MockedCall,
    setupAsyncStoreWithClient,
    stubClient,
    useMockedCalls,
} from "../../../../test-utils";
import RoomCallBanner from "../../../../../src/components/views/beacon/RoomCallBanner";
import { CallStore } from "../../../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../../../src/stores/widgets/WidgetMessagingStore";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { ConnectionState } from "../../../../../src/models/Call";
import { SdkContextClass } from "../../../../../src/contexts/SDKContext";

describe("<RoomCallBanner />", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    useMockedCalls();

    const defaultProps = {
        roomId: "!1:example.org",
    };

    beforeEach(() => {
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

    afterEach(async () => {
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
    });

    const renderBanner = async (props = {}): Promise<void> => {
        render(<RoomCallBanner {...defaultProps} {...props} />);
        await act(() => Promise.resolve()); // Let effects settle
    };

    it("renders nothing when there is no call", async () => {
        await renderBanner();
        const banner = await screen.queryByText("Video call");
        expect(banner).toBeFalsy();
    });

    describe("call started", () => {
        let call: MockedCall;
        let widget: Widget;

        beforeEach(() => {
            MockedCall.create(room, "1");
            const maybeCall = CallStore.instance.getCall(room.roomId);
            if (!(maybeCall instanceof MockedCall)) {
                throw new Error("Failed to create call");
            }
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

        it("renders if there is a call", async () => {
            await renderBanner();
            await screen.findByText("Video call");
        });

        it("shows Join button if the user has not joined", async () => {
            await renderBanner();
            await screen.findByText("Join");
        });

        it("doesn't show banner if the call is connected", async () => {
            call.setConnectionState(ConnectionState.Connected);
            await renderBanner();
            const banner = await screen.queryByText("Video call");
            expect(banner).toBeFalsy();
        });

        it("doesn't show banner if the call is shown", async () => {
            jest.spyOn(SdkContextClass.instance.roomViewStore, "isViewingCall");
            mocked(SdkContextClass.instance.roomViewStore.isViewingCall).mockReturnValue(true);
            await renderBanner();
            const banner = await screen.queryByText("Video call");
            expect(banner).toBeFalsy();
        });
    });

    // TODO: test clicking buttons
    // TODO: add live location share warning test (should not render if there is an active live location share)
});
