/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked, type Mocked } from "jest-mock";
import { screen, render, act, cleanup } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import {
    type MatrixClient,
    PendingEventOrdering,
    Room,
    RoomStateEvent,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { Widget, type ClientWidgetApi } from "matrix-widget-api";
import { type UserEvent } from "@testing-library/user-event/dist/types/setup/setup";

import {
    useMockedCalls,
    MockedCall,
    mkRoomMember,
    stubClient,
    setupAsyncStoreWithClient,
    resetAsyncStoreWithClient,
    wrapInMatrixClientContext,
    wrapInSdkContext,
    mkRoomCreateEvent,
    mockPlatformPeg,
    useMockMediaDevices,
} from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { CallStore } from "../../../../src/stores/CallStore";
import { WidgetMessagingStore } from "../../../../src/stores/widgets/WidgetMessagingStore";
import { PipContainer as UnwrappedPipContainer } from "../../../../src/components/structures/PipContainer";
import ActiveWidgetStore from "../../../../src/stores/ActiveWidgetStore";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { type ViewRoomPayload } from "../../../../src/dispatcher/payloads/ViewRoomPayload";
import { TestSdkContext } from "../../TestSdkContext";
import { RoomViewStore } from "../../../../src/stores/RoomViewStore";
import { Container, WidgetLayoutStore } from "../../../../src/stores/widgets/WidgetLayoutStore";
import WidgetStore from "../../../../src/stores/WidgetStore";
import { WidgetType } from "../../../../src/widgets/WidgetType";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import { ElementWidgetActions } from "../../../../src/stores/widgets/ElementWidgetActions";

jest.mock("../../../../src/stores/OwnProfileStore", () => ({
    OwnProfileStore: {
        instance: {
            isProfileInfoFetched: true,
            removeListener: jest.fn(),
            getHttpAvatarUrl: jest.fn().mockReturnValue("http://avatar_url"),
        },
    },
}));

describe("PipContainer", () => {
    useMockedCalls();
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let user: UserEvent;
    let sdkContext: TestSdkContext;
    let client: Mocked<MatrixClient>;
    let room: Room;
    let room2: Room;
    let alice: RoomMember;

    beforeEach(async () => {
        useMockMediaDevices();

        user = userEvent.setup();

        stubClient();
        client = mocked(MatrixClientPeg.safeGet());
        client.getUserId.mockReturnValue("@alice:example.org");
        client.getSafeUserId.mockReturnValue("@alice:example.org");
        DMRoomMap.makeShared(client);

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        alice = mkRoomMember(room.roomId, "@alice:example.org");

        room2 = new Room("!2:example.com", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        client.getRoom.mockImplementation((roomId: string) => {
            if (roomId === room.roomId) return room;
            if (roomId === room2.roomId) return room2;
            return null;
        });
        client.getRooms.mockReturnValue([room, room2]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        room.currentState.setStateEvents([mkRoomCreateEvent(alice.userId, room.roomId)]);
        jest.spyOn(room, "getMember").mockImplementation((userId) => (userId === alice.userId ? alice : null));

        room2.currentState.setStateEvents([mkRoomCreateEvent(alice.userId, room2.roomId)]);

        await Promise.all(
            [CallStore.instance, WidgetMessagingStore.instance].map((store) =>
                setupAsyncStoreWithClient(store, client),
            ),
        );

        sdkContext = new TestSdkContext();
        // @ts-ignore PipContainer uses SDKContext in the constructor
        SdkContextClass.instance = sdkContext;
        sdkContext.client = client;
    });

    afterEach(async () => {
        cleanup();
        await Promise.all([CallStore.instance, WidgetMessagingStore.instance].map(resetAsyncStoreWithClient));
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
        jest.clearAllMocks();
    });

    const renderPip = () => {
        const PipContainer = wrapInMatrixClientContext(wrapInSdkContext(UnwrappedPipContainer, sdkContext));
        render(<PipContainer />);
    };

    const viewRoom = (roomId: string) => {
        defaultDispatcher.dispatch<ViewRoomPayload>(
            {
                action: Action.ViewRoom,
                room_id: roomId,
                metricsTrigger: undefined,
            },
            true,
        );
    };

    const withCall = async (fn: (call: MockedCall) => Promise<void>): Promise<void> => {
        MockedCall.create(room, "1");
        const call = CallStore.instance.getCall(room.roomId);
        if (!(call instanceof MockedCall)) throw new Error("Failed to create call");

        const widget = new Widget(call.widget);
        await act(async () => {
            WidgetStore.instance.addVirtualWidget(call.widget, room.roomId);
            WidgetMessagingStore.instance.storeMessaging(widget, room.roomId, {
                stop: () => {},
            } as unknown as ClientWidgetApi);

            await call.start();
            ActiveWidgetStore.instance.setWidgetPersistence(widget.id, room.roomId, true);
        });

        await fn(call);

        cleanup();
        act(() => {
            call.destroy();
            ActiveWidgetStore.instance.destroyPersistentWidget(widget.id, room.roomId);
            WidgetStore.instance.removeVirtualWidget(widget.id, room.roomId);
        });
    };

    const withWidget = async (fn: () => Promise<void>): Promise<void> => {
        act(() => ActiveWidgetStore.instance.setWidgetPersistence("1", room.roomId, true));
        await fn();
        cleanup();
        ActiveWidgetStore.instance.destroyPersistentWidget("1", room.roomId);
    };

    const setUpRoomViewStore = () => {
        sdkContext._RoomViewStore = new RoomViewStore(defaultDispatcher, sdkContext);
    };

    it("hides if there's no content", () => {
        renderPip();
        expect(screen.queryByRole("complementary")).toBeNull();
    });

    it("shows an active call with back and leave buttons", async () => {
        renderPip();

        await withCall(async (call) => {
            screen.getByRole("complementary");

            // The return button should jump to the call
            const dispatcherSpy = jest.fn();
            const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
            await user.click(screen.getByRole("button", { name: "Back" }));
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                view_call: true,
                metricsTrigger: expect.any(String),
            });
            defaultDispatcher.unregister(dispatcherRef);

            // The leave button should disconnect from the call
            const disconnectSpy = jest.spyOn(call, "disconnect");
            await user.click(screen.getByRole("button", { name: "Leave" }));
            expect(disconnectSpy).toHaveBeenCalled();
        });
    });

    it("shows a persistent widget with back button when viewing the room", async () => {
        setUpRoomViewStore();
        viewRoom(room.roomId);
        const widget = WidgetStore.instance.addVirtualWidget(
            {
                id: "1",
                creatorUserId: "@alice:example.org",
                type: WidgetType.CUSTOM.preferred,
                url: "https://example.org",
                name: "Example widget",
            },
            room.roomId,
        );
        renderPip();

        await withWidget(async () => {
            screen.getByRole("complementary");

            // The return button should maximize the widget
            const moveSpy = jest.spyOn(WidgetLayoutStore.instance, "moveToContainer");
            await user.click(await screen.findByRole("button", { name: "Back" }));
            expect(moveSpy).toHaveBeenCalledWith(room, widget, Container.Center);

            expect(screen.queryByRole("button", { name: "Leave" })).toBeNull();
        });

        WidgetStore.instance.removeVirtualWidget("1", room.roomId);
    });

    it("shows a persistent Jitsi widget with back and leave buttons when not viewing the room", async () => {
        mockPlatformPeg({ supportsJitsiScreensharing: () => true });
        setUpRoomViewStore();
        viewRoom(room2.roomId);
        const widget = WidgetStore.instance.addVirtualWidget(
            {
                id: "1",
                creatorUserId: "@alice:example.org",
                type: WidgetType.JITSI.preferred,
                url: "https://meet.example.org",
                name: "Jitsi example",
            },
            room.roomId,
        );
        renderPip();

        await withWidget(async () => {
            screen.getByRole("complementary");

            // The return button should view the room
            const dispatcherSpy = jest.fn();
            const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
            await user.click(await screen.findByRole("button", { name: "Back" }));
            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: expect.any(String),
            });
            defaultDispatcher.unregister(dispatcherRef);

            // The leave button should hangup the call
            const sendSpy = jest
                .fn<
                    ReturnType<ClientWidgetApi["transport"]["send"]>,
                    Parameters<ClientWidgetApi["transport"]["send"]>
                >()
                .mockResolvedValue({});
            const mockMessaging = { transport: { send: sendSpy }, stop: () => {} } as unknown as ClientWidgetApi;
            WidgetMessagingStore.instance.storeMessaging(new Widget(widget), room.roomId, mockMessaging);
            await user.click(screen.getByRole("button", { name: "Leave" }));
            expect(sendSpy).toHaveBeenCalledWith(ElementWidgetActions.HangupCall, {});
        });

        WidgetStore.instance.removeVirtualWidget("1", room.roomId);
    });
});
