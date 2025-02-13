/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, act, type RenderResult } from "jest-matrix-react";
import { mocked, type Mocked } from "jest-mock";
import {
    type MatrixClient,
    PendingEventOrdering,
    Room,
    RoomStateEvent,
    type Thread,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { Widget } from "matrix-widget-api";

import type { ClientWidgetApi } from "matrix-widget-api";
import {
    stubClient,
    mkRoomMember,
    MockedCall,
    useMockedCalls,
    setupAsyncStoreWithClient,
    filterConsole,
    flushPromises,
    mkMessage,
    useMockMediaDevices,
} from "../../../../test-utils";
import { CallStore } from "../../../../../src/stores/CallStore";
import RoomTile from "../../../../../src/components/views/rooms/RoomTile";
import { DefaultTagID } from "../../../../../src/stores/room-list/models";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import PlatformPeg from "../../../../../src/PlatformPeg";
import type BasePlatform from "../../../../../src/BasePlatform";
import { WidgetMessagingStore } from "../../../../../src/stores/widgets/WidgetMessagingStore";
import { TestSdkContext } from "../../../TestSdkContext";
import { SDKContext } from "../../../../../src/contexts/SDKContext";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../../src/settings/UIFeature";
import { MessagePreviewStore } from "../../../../../src/stores/room-list/MessagePreviewStore";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../../src/settings/SettingsStore";

jest.mock("../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("RoomTile", () => {
    jest.spyOn(PlatformPeg, "get").mockReturnValue({
        overrideBrowserShortcuts: () => false,
    } as unknown as BasePlatform);
    useMockedCalls();

    const renderRoomTile = (): RenderResult => {
        return render(
            <SDKContext.Provider value={sdkContext}>
                <RoomTile
                    room={room}
                    showMessagePreview={showMessagePreview}
                    isMinimized={false}
                    tag={DefaultTagID.Untagged}
                />
            </SDKContext.Provider>,
        );
    };

    let client: Mocked<MatrixClient>;
    let room: Room;
    let sdkContext: TestSdkContext;
    let showMessagePreview = false;

    filterConsole(
        // irrelevant for this test
        "Room !1:example.org does not have an m.room.create event",
    );

    const addMessageToRoom = (ts: number) => {
        const message = mkMessage({
            event: true,
            room: room.roomId,
            msg: "test message",
            user: client.getSafeUserId(),
            ts,
        });

        room.timeline.push(message);
    };

    const addThreadMessageToRoom = (ts: number) => {
        const message = mkMessage({
            event: true,
            room: room.roomId,
            msg: "test thread reply",
            user: client.getSafeUserId(),
            ts,
        });

        // Mock thread reply for tests.
        jest.spyOn(room, "getThreads").mockReturnValue([
            // @ts-ignore
            {
                lastReply: () => message,
                timeline: [],
            } as Thread,
        ]);
    };

    beforeEach(() => {
        useMockMediaDevices();
        sdkContext = new TestSdkContext();

        client = mocked(stubClient());
        sdkContext.client = client;
        DMRoomMap.makeShared(client);

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        client.getRoom.mockImplementation((roomId) => (roomId === room.roomId ? room : null));
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);
    });

    afterEach(() => {
        // @ts-ignore
        MessagePreviewStore.instance.previews = new Map<string, Map<TagID | TAG_ANY, MessagePreview | null>>();
        jest.clearAllMocks();
    });

    describe("when message previews are not enabled", () => {
        it("should render the room", () => {
            mocked(shouldShowComponent).mockReturnValue(true);
            const { container } = renderRoomTile();
            expect(container).toMatchSnapshot();
            expect(container.querySelector(".mx_RoomTile_sticky")).not.toBeInTheDocument();
        });

        it("does not render the room options context menu when UIComponent customisations disable room options", () => {
            mocked(shouldShowComponent).mockReturnValue(false);
            renderRoomTile();
            expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.RoomOptionsMenu);
            expect(screen.queryByRole("button", { name: "Room options" })).not.toBeInTheDocument();
        });

        it("renders the room options context menu when UIComponent customisations enable room options", () => {
            mocked(shouldShowComponent).mockReturnValue(true);
            renderRoomTile();
            expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.RoomOptionsMenu);
            expect(screen.queryByRole("button", { name: "Room options" })).toBeInTheDocument();
        });

        it("does not render the room options context menu when knocked to the room", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => {
                return name === "feature_ask_to_join";
            });
            mocked(shouldShowComponent).mockReturnValue(true);
            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Knock);
            const { container } = renderRoomTile();
            expect(container.querySelector(".mx_RoomTile_sticky")).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Room options" })).not.toBeInTheDocument();
        });

        it("does not render the room options context menu when knock has been denied", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => {
                return name === "feature_ask_to_join";
            });
            mocked(shouldShowComponent).mockReturnValue(true);
            const roomMember = mkRoomMember(
                room.roomId,
                MatrixClientPeg.get()!.getSafeUserId(),
                KnownMembership.Leave,
                true,
                {
                    membership: KnownMembership.Knock,
                },
            );
            jest.spyOn(room, "getMember").mockReturnValue(roomMember);
            const { container } = renderRoomTile();
            expect(container.querySelector(".mx_RoomTile_sticky")).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Room options" })).not.toBeInTheDocument();
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
                call.destroy();
                client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
                WidgetMessagingStore.instance.stopMessaging(widget, room.roomId);
            });

            it("tracks connection state", async () => {
                renderRoomTile();
                screen.getByText("Video");
                await act(() => call.start());
                screen.getByText("Joined");
                await act(() => call.disconnect());
                screen.getByText("Video");
            });

            it("tracks participants", () => {
                renderRoomTile();
                const alice: [RoomMember, Set<string>] = [
                    mkRoomMember(room.roomId, "@alice:example.org"),
                    new Set(["a"]),
                ];
                const bob: [RoomMember, Set<string>] = [
                    mkRoomMember(room.roomId, "@bob:example.org"),
                    new Set(["b1", "b2"]),
                ];
                const carol: [RoomMember, Set<string>] = [
                    mkRoomMember(room.roomId, "@carol:example.org"),
                    new Set(["c"]),
                ];

                expect(screen.queryByLabelText(/participant/)).toBe(null);

                act(() => {
                    call.participants = new Map([alice]);
                });
                expect(screen.getByLabelText("1 person joined").textContent).toBe("1");

                act(() => {
                    call.participants = new Map([alice, bob, carol]);
                });
                expect(screen.getByLabelText("4 people joined").textContent).toBe("4");

                act(() => {
                    call.participants = new Map();
                });
                expect(screen.queryByLabelText(/participant/)).toBe(null);
            });
        });
    });

    describe("when message previews are enabled", () => {
        beforeEach(() => {
            showMessagePreview = true;
        });

        it("should render a room without a message as expected", async () => {
            const renderResult = renderRoomTile();
            // flush promises here because the preview is created asynchronously
            await flushPromises();
            expect(renderResult.asFragment()).toMatchSnapshot();
        });

        describe("and there is a message in the room", () => {
            beforeEach(() => {
                addMessageToRoom(23);
            });

            it("should render as expected", async () => {
                const renderResult = renderRoomTile();
                expect(await screen.findByText("test message")).toBeInTheDocument();
                expect(renderResult.asFragment()).toMatchSnapshot();
            });
        });

        describe("and there is a message in a thread", () => {
            beforeEach(() => {
                addThreadMessageToRoom(23);
            });

            it("should render as expected", async () => {
                const renderResult = renderRoomTile();
                expect(await screen.findByText("test thread reply")).toBeInTheDocument();
                expect(renderResult.asFragment()).toMatchSnapshot();
            });
        });

        describe("and there is a message and a thread without a reply", () => {
            beforeEach(() => {
                addMessageToRoom(23);

                // Mock thread reply for tests.
                jest.spyOn(room, "getThreads").mockReturnValue([
                    // @ts-ignore
                    {
                        lastReply: () => null,
                        timeline: [],
                        findEventById: () => {},
                    } as Thread,
                ]);
            });

            it("should render the message preview", async () => {
                renderRoomTile();
                expect(await screen.findByText("test message")).toBeInTheDocument();
            });
        });
    });
});
