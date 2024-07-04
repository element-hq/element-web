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

import React, { createRef, RefObject } from "react";
import { mocked, MockedObject } from "jest-mock";
import {
    ClientEvent,
    MatrixClient,
    Room,
    RoomEvent,
    EventType,
    JoinRule,
    MatrixError,
    RoomStateEvent,
    MatrixEvent,
    SearchResult,
    IEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { MEGOLM_ALGORITHM } from "matrix-js-sdk/src/crypto/olmlib";
import { fireEvent, render, screen, RenderResult, waitForElementToBeRemoved, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
    stubClient,
    mockPlatformPeg,
    unmockPlatformPeg,
    wrapInMatrixClientContext,
    flushPromises,
    mkEvent,
    setupAsyncStoreWithClient,
    filterConsole,
    mkRoomMemberJoinEvent,
    mkThirdPartyInviteEvent,
    emitPromise,
    createTestClient,
    untilDispatch,
} from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { Action } from "../../../src/dispatcher/actions";
import dis, { defaultDispatcher } from "../../../src/dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../src/dispatcher/payloads/ViewRoomPayload";
import { RoomView as _RoomView } from "../../../src/components/structures/RoomView";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { NotificationState } from "../../../src/stores/notifications/NotificationState";
import { RightPanelPhases } from "../../../src/stores/right-panel/RightPanelStorePhases";
import { LocalRoom, LocalRoomState } from "../../../src/models/LocalRoom";
import { DirectoryMember } from "../../../src/utils/direct-messages";
import { createDmLocalRoom } from "../../../src/utils/dm/createDmLocalRoom";
import { UPDATE_EVENT } from "../../../src/stores/AsyncStore";
import { SDKContext, SdkContextClass } from "../../../src/contexts/SDKContext";
import VoipUserMapper from "../../../src/VoipUserMapper";
import WidgetUtils from "../../../src/utils/WidgetUtils";
import { WidgetType } from "../../../src/widgets/WidgetType";
import WidgetStore from "../../../src/stores/WidgetStore";
import { ViewRoomErrorPayload } from "../../../src/dispatcher/payloads/ViewRoomErrorPayload";
import { SearchScope } from "../../../src/components/views/rooms/SearchBar";

const RoomView = wrapInMatrixClientContext(_RoomView);

describe("RoomView", () => {
    let cli: MockedObject<MatrixClient>;
    let room: Room;
    let rooms: Map<string, Room>;
    let roomCount = 0;
    let stores: SdkContextClass;

    // mute some noise
    filterConsole("RVS update", "does not have an m.room.create event", "Current version: 1", "Version capability");

    beforeEach(() => {
        mockPlatformPeg({ reload: () => {} });
        stubClient();
        cli = mocked(MatrixClientPeg.safeGet());

        room = new Room(`!${roomCount++}:example.org`, cli, "@alice:example.org");
        jest.spyOn(room, "findPredecessor");
        room.getPendingEvents = () => [];
        rooms = new Map();
        rooms.set(room.roomId, room);
        cli.getRoom.mockImplementation((roomId: string | undefined) => rooms.get(roomId || "") || null);
        // Re-emit certain events on the mocked client
        room.on(RoomEvent.Timeline, (...args) => cli.emit(RoomEvent.Timeline, ...args));
        room.on(RoomEvent.TimelineReset, (...args) => cli.emit(RoomEvent.TimelineReset, ...args));

        DMRoomMap.makeShared(cli);
        stores = new SdkContextClass();
        stores.client = cli;
        stores.rightPanelStore.useUnitTestClient(cli);

        jest.spyOn(VoipUserMapper.sharedInstance(), "getVirtualRoomForRoom").mockResolvedValue(undefined);
    });

    afterEach(() => {
        unmockPlatformPeg();
        jest.clearAllMocks();
    });

    const mountRoomView = async (ref?: RefObject<_RoomView>): Promise<RenderResult> => {
        if (stores.roomViewStore.getRoomId() !== room.roomId) {
            const switchedRoom = new Promise<void>((resolve) => {
                const subFn = () => {
                    if (stores.roomViewStore.getRoomId()) {
                        stores.roomViewStore.off(UPDATE_EVENT, subFn);
                        resolve();
                    }
                };
                stores.roomViewStore.on(UPDATE_EVENT, subFn);
            });

            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: undefined,
            });

            await switchedRoom;
        }

        const roomView = render(
            <SDKContext.Provider value={stores}>
                <RoomView
                    // threepidInvite should be optional on RoomView props
                    // it is treated as optional in RoomView
                    threepidInvite={undefined as any}
                    resizeNotifier={new ResizeNotifier()}
                    forceTimeline={false}
                    wrappedRef={ref as any}
                />
            </SDKContext.Provider>,
        );
        await flushPromises();
        return roomView;
    };

    const renderRoomView = async (switchRoom = true): Promise<ReturnType<typeof render>> => {
        if (switchRoom && stores.roomViewStore.getRoomId() !== room.roomId) {
            const switchedRoom = new Promise<void>((resolve) => {
                const subFn = () => {
                    if (stores.roomViewStore.getRoomId()) {
                        stores.roomViewStore.off(UPDATE_EVENT, subFn);
                        resolve();
                    }
                };
                stores.roomViewStore.on(UPDATE_EVENT, subFn);
            });

            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: undefined,
            });

            await switchedRoom;
        }

        const roomView = render(
            <SDKContext.Provider value={stores}>
                <RoomView
                    // threepidInvite should be optional on RoomView props
                    // it is treated as optional in RoomView
                    threepidInvite={undefined as any}
                    resizeNotifier={new ResizeNotifier()}
                    forceTimeline={false}
                    onRegistered={jest.fn()}
                />
            </SDKContext.Provider>,
        );
        await flushPromises();
        return roomView;
    };
    const getRoomViewInstance = async (): Promise<_RoomView> => {
        const ref = createRef<_RoomView>();
        await mountRoomView(ref);
        return ref.current!;
    };

    it("when there is no room predecessor, getHiddenHighlightCount should return 0", async () => {
        const instance = await getRoomViewInstance();
        expect(instance.getHiddenHighlightCount()).toBe(0);
    });

    describe("when there is an old room", () => {
        let instance: _RoomView;
        let oldRoom: Room;

        beforeEach(async () => {
            instance = await getRoomViewInstance();
            oldRoom = new Room("!old:example.com", cli, cli.getSafeUserId());
            rooms.set(oldRoom.roomId, oldRoom);
            jest.spyOn(room, "findPredecessor").mockReturnValue({ roomId: oldRoom.roomId });
        });

        it("and it has 0 unreads, getHiddenHighlightCount should return 0", async () => {
            jest.spyOn(oldRoom, "getUnreadNotificationCount").mockReturnValue(0);
            expect(instance.getHiddenHighlightCount()).toBe(0);
            // assert that msc3946ProcessDynamicPredecessor is false by default
            expect(room.findPredecessor).toHaveBeenCalledWith(false);
        });

        it("and it has 23 unreads, getHiddenHighlightCount should return 23", async () => {
            jest.spyOn(oldRoom, "getUnreadNotificationCount").mockReturnValue(23);
            expect(instance.getHiddenHighlightCount()).toBe(23);
        });

        describe("and feature_dynamic_room_predecessors is enabled", () => {
            beforeEach(() => {
                instance.setState({ msc3946ProcessDynamicPredecessor: true });
            });

            afterEach(() => {
                instance.setState({ msc3946ProcessDynamicPredecessor: false });
            });

            it("should pass the setting to findPredecessor", async () => {
                expect(instance.getHiddenHighlightCount()).toBe(0);
                expect(room.findPredecessor).toHaveBeenCalledWith(true);
            });
        });
    });

    it("updates url preview visibility on encryption state change", async () => {
        room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);
        // we should be starting unencrypted
        expect(cli.isCryptoEnabled()).toEqual(false);
        expect(cli.isRoomEncrypted(room.roomId)).toEqual(false);

        const roomViewInstance = await getRoomViewInstance();

        // in a default (non-encrypted room, it should start out with url previews enabled)
        // This is a white-box test in that we're asserting things about the state, which
        // is not ideal, but asserting that a URL preview just isn't there could risk the
        // test being invalid because the previews just hasn't rendered yet. This feels
        // like the safest way I think?
        // This also relies on the default settings being URL previews on normally and
        // off for e2e rooms because 1) it's probably useful to assert this and
        // 2) SettingsStore is a static class and so very hard to mock out.
        expect(roomViewInstance.state.showUrlPreview).toBe(true);

        // now enable encryption
        cli.isCryptoEnabled.mockReturnValue(true);
        cli.isRoomEncrypted.mockReturnValue(true);

        // and fake an encryption event into the room to prompt it to re-check
        room.addLiveEvents([
            new MatrixEvent({
                type: "m.room.encryption",
                sender: cli.getUserId()!,
                content: {},
                event_id: "someid",
                room_id: room.roomId,
            }),
        ]);

        // URL previews should now be disabled
        expect(roomViewInstance.state.showUrlPreview).toBe(false);
    });

    it("updates live timeline when a timeline reset happens", async () => {
        const roomViewInstance = await getRoomViewInstance();
        const oldTimeline = roomViewInstance.state.liveTimeline;

        room.getUnfilteredTimelineSet().resetLiveTimeline();
        expect(roomViewInstance.state.liveTimeline).not.toEqual(oldTimeline);
    });

    describe("with virtual rooms", () => {
        it("checks for a virtual room on initial load", async () => {
            const { container } = await renderRoomView();
            expect(VoipUserMapper.sharedInstance().getVirtualRoomForRoom).toHaveBeenCalledWith(room.roomId);

            // quick check that rendered without error
            expect(container.querySelector(".mx_ErrorBoundary")).toBeFalsy();
        });

        it("checks for a virtual room on room event", async () => {
            await renderRoomView();
            expect(VoipUserMapper.sharedInstance().getVirtualRoomForRoom).toHaveBeenCalledWith(room.roomId);

            cli.emit(ClientEvent.Room, room);

            // called again after room event
            expect(VoipUserMapper.sharedInstance().getVirtualRoomForRoom).toHaveBeenCalledTimes(2);
        });
    });

    describe("video rooms", () => {
        beforeEach(async () => {
            // Make it a video room
            room.isElementVideoRoom = () => true;
            await SettingsStore.setValue("feature_video_rooms", null, SettingLevel.DEVICE, true);
        });

        it("normally doesn't open the chat panel", async () => {
            jest.spyOn(NotificationState.prototype, "isUnread", "get").mockReturnValue(false);
            await mountRoomView();
            expect(stores.rightPanelStore.isOpen).toEqual(false);
        });

        it("opens the chat panel if there are unread messages", async () => {
            jest.spyOn(NotificationState.prototype, "isUnread", "get").mockReturnValue(true);
            await mountRoomView();
            expect(stores.rightPanelStore.isOpen).toEqual(true);
            expect(stores.rightPanelStore.currentCard.phase).toEqual(RightPanelPhases.Timeline);
        });
    });

    describe("for a local room", () => {
        let localRoom: LocalRoom;

        beforeEach(async () => {
            localRoom = room = await createDmLocalRoom(cli, [new DirectoryMember({ user_id: "@user:example.com" })]);
            rooms.set(localRoom.roomId, localRoom);
            cli.store.storeRoom(room);
        });

        it("should remove the room from the store on unmount", async () => {
            const { unmount } = await renderRoomView();
            unmount();
            expect(cli.store.removeRoom).toHaveBeenCalledWith(room.roomId);
        });

        describe("in state NEW", () => {
            it("should match the snapshot", async () => {
                const { container } = await renderRoomView();
                expect(container).toMatchSnapshot();
            });

            describe("that is encrypted", () => {
                beforeEach(() => {
                    mocked(cli.isRoomEncrypted).mockReturnValue(true);
                    localRoom.encrypted = true;
                    localRoom.currentState.setStateEvents([
                        new MatrixEvent({
                            event_id: `~${localRoom.roomId}:${cli.makeTxnId()}`,
                            type: EventType.RoomEncryption,
                            content: {
                                algorithm: MEGOLM_ALGORITHM,
                            },
                            user_id: cli.getUserId()!,
                            sender: cli.getUserId()!,
                            state_key: "",
                            room_id: localRoom.roomId,
                            origin_server_ts: Date.now(),
                        }),
                    ]);
                });

                it("should match the snapshot", async () => {
                    const { container } = await renderRoomView();
                    expect(container).toMatchSnapshot();
                });
            });
        });

        it("in state CREATING should match the snapshot", async () => {
            localRoom.state = LocalRoomState.CREATING;
            const { container } = await renderRoomView();
            expect(container).toMatchSnapshot();
        });

        describe("in state ERROR", () => {
            beforeEach(async () => {
                localRoom.state = LocalRoomState.ERROR;
            });

            it("should match the snapshot", async () => {
                const { container } = await renderRoomView();
                expect(container).toMatchSnapshot();
            });

            it("clicking retry should set the room state to new dispatch a local room event", async () => {
                jest.spyOn(defaultDispatcher, "dispatch");
                const { getByText } = await renderRoomView();
                fireEvent.click(getByText("Retry"));
                expect(localRoom.state).toBe(LocalRoomState.NEW);
                expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                    action: "local_room_event",
                    roomId: room.roomId,
                });
            });
        });
    });

    describe("when rendering a DM room with a single third-party invite", () => {
        beforeEach(async () => {
            room.currentState.setStateEvents([
                mkRoomMemberJoinEvent(cli.getSafeUserId(), room.roomId),
                mkThirdPartyInviteEvent(cli.getSafeUserId(), "user@example.com", room.roomId),
            ]);
            jest.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(cli.getSafeUserId());
            jest.spyOn(DMRoomMap.shared(), "getRoomIds").mockReturnValue(new Set([room.roomId]));
            mocked(cli).isRoomEncrypted.mockReturnValue(true);
            await renderRoomView();
        });

        it("should render the »waiting for third-party« view", () => {
            expect(screen.getByText("Waiting for users to join Element")).toBeInTheDocument();
            expect(
                screen.getByText(
                    "Once invited users have joined Element, you will be able to chat and the room will be end-to-end encrypted",
                ),
            ).toBeInTheDocument();

            // no message composer
            expect(screen.queryByText("Send an encrypted message…")).not.toBeInTheDocument();
            expect(screen.queryByText("Send a message…")).not.toBeInTheDocument();
        });
    });

    describe("when there is a RoomView", () => {
        const widget1Id = "widget1";
        const widget2Id = "widget2";
        const otherUserId = "@other:example.com";

        const addJitsiWidget = async (id: string, user: string, ts?: number): Promise<void> => {
            const widgetEvent = mkEvent({
                event: true,
                room: room.roomId,
                user,
                type: "im.vector.modular.widgets",
                content: {
                    id,
                    name: "Jitsi",
                    type: WidgetType.JITSI.preferred,
                    url: "https://example.com",
                },
                skey: id,
                ts,
            });
            room.addLiveEvents([widgetEvent]);
            room.currentState.setStateEvents([widgetEvent]);
            cli.emit(RoomStateEvent.Events, widgetEvent, room.currentState, null);
            await flushPromises();
        };

        beforeEach(async () => {
            jest.spyOn(WidgetUtils, "setRoomWidget");
            const widgetStore = WidgetStore.instance;
            await setupAsyncStoreWithClient(widgetStore, cli);
            getRoomViewInstance();
        });

        const itShouldNotRemoveTheLastWidget = (): void => {
            it("should not remove the last widget", (): void => {
                expect(WidgetUtils.setRoomWidget).not.toHaveBeenCalledWith(room.roomId, widget2Id);
            });
        };

        describe("and there is a Jitsi widget from another user", () => {
            beforeEach(async () => {
                await addJitsiWidget(widget1Id, otherUserId, 10_000);
            });

            describe("and the current user adds a Jitsi widget after 10s", () => {
                beforeEach(async () => {
                    await addJitsiWidget(widget2Id, cli.getSafeUserId(), 20_000);
                });

                it("the last Jitsi widget should be removed", () => {
                    expect(WidgetUtils.setRoomWidget).toHaveBeenCalledWith(cli, room.roomId, widget2Id);
                });
            });

            describe("and the current user adds a Jitsi widget after two minutes", () => {
                beforeEach(async () => {
                    await addJitsiWidget(widget2Id, cli.getSafeUserId(), 130_000);
                });

                itShouldNotRemoveTheLastWidget();
            });

            describe("and the current user adds a Jitsi widget without timestamp", () => {
                beforeEach(async () => {
                    await addJitsiWidget(widget2Id, cli.getSafeUserId());
                });

                itShouldNotRemoveTheLastWidget();
            });
        });

        describe("and there is a Jitsi widget from another user without timestamp", () => {
            beforeEach(async () => {
                await addJitsiWidget(widget1Id, otherUserId);
            });

            describe("and the current user adds a Jitsi widget", () => {
                beforeEach(async () => {
                    await addJitsiWidget(widget2Id, cli.getSafeUserId(), 10_000);
                });

                itShouldNotRemoveTheLastWidget();
            });
        });
    });

    it("should show error view if failed to look up room alias", async () => {
        const { asFragment, findByText } = await renderRoomView(false);

        defaultDispatcher.dispatch<ViewRoomErrorPayload>({
            action: Action.ViewRoomError,
            room_alias: "#addy:server",
            room_id: null,
            err: new MatrixError({ errcode: "M_NOT_FOUND" }),
        });
        await emitPromise(stores.roomViewStore, UPDATE_EVENT);

        await findByText("Are you sure you're at the right place?");
        expect(asFragment()).toMatchSnapshot();
    });

    describe("Peeking", () => {
        beforeEach(() => {
            // Make room peekable
            room.currentState.setStateEvents([
                new MatrixEvent({
                    type: "m.room.history_visibility",
                    state_key: "",
                    content: {
                        history_visibility: "world_readable",
                    },
                    room_id: room.roomId,
                }),
            ]);
        });

        it("should show forget room button for non-guests", async () => {
            mocked(cli.isGuest).mockReturnValue(false);
            await mountRoomView();

            expect(screen.getByLabelText("Forget room")).toBeInTheDocument();
        });

        it("should not show forget room button for guests", async () => {
            mocked(cli.isGuest).mockReturnValue(true);
            await mountRoomView();
            expect(screen.queryByLabelText("Forget room")).not.toBeInTheDocument();
        });
    });

    describe("knock rooms", () => {
        const client = createTestClient();

        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => setting === "feature_ask_to_join");
            jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
            jest.spyOn(dis, "dispatch");
        });

        it("allows to request to join", async () => {
            jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client);
            jest.spyOn(client, "knockRoom").mockResolvedValue({ room_id: room.roomId });

            await mountRoomView();
            fireEvent.click(screen.getByRole("button", { name: "Request access" }));
            await untilDispatch(Action.SubmitAskToJoin, dis);

            expect(dis.dispatch).toHaveBeenCalledWith({
                action: "submit_ask_to_join",
                roomId: room.roomId,
                opts: { reason: undefined },
            });
        });

        it("allows to cancel a join request", async () => {
            jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client);
            jest.spyOn(client, "leave").mockResolvedValue({});
            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Knock);

            await mountRoomView();
            fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
            await untilDispatch(Action.CancelAskToJoin, dis);

            expect(dis.dispatch).toHaveBeenCalledWith({ action: "cancel_ask_to_join", roomId: room.roomId });
        });
    });

    it("should close search results when edit is clicked", async () => {
        room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

        const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);

        const roomViewRef = createRef<_RoomView>();
        const { container, getByText, findByLabelText } = await mountRoomView(roomViewRef);
        // @ts-ignore - triggering a search organically is a lot of work
        roomViewRef.current!.setState({
            search: {
                searchId: 1,
                roomId: room.roomId,
                term: "search term",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [
                        SearchResult.fromJson(
                            {
                                rank: 1,
                                result: {
                                    content: {
                                        body: "search term",
                                        msgtype: "m.text",
                                    },
                                    type: "m.room.message",
                                    event_id: "$eventId",
                                    sender: cli.getSafeUserId(),
                                    origin_server_ts: 123456789,
                                    room_id: room.roomId,
                                },
                                context: {
                                    events_before: [],
                                    events_after: [],
                                    profile_info: {},
                                },
                            },
                            eventMapper,
                        ),
                    ],
                    highlights: [],
                    count: 1,
                }),
                inProgress: false,
                count: 1,
            },
        });

        await waitFor(() => {
            expect(container.querySelector(".mx_RoomView_searchResultsPanel")).toBeVisible();
        });
        const prom = waitForElementToBeRemoved(() => container.querySelector(".mx_RoomView_searchResultsPanel"));

        await userEvent.hover(getByText("search term"));
        await userEvent.click(await findByLabelText("Edit"));

        await prom;
    });

    it("should switch rooms when edit is clicked on a search result for a different room", async () => {
        const room2 = new Room(`!${roomCount++}:example.org`, cli, "@alice:example.org");
        rooms.set(room2.roomId, room2);

        room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

        const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);

        const roomViewRef = createRef<_RoomView>();
        const { container, getByText, findByLabelText } = await mountRoomView(roomViewRef);
        // @ts-ignore - triggering a search organically is a lot of work
        roomViewRef.current!.setState({
            search: {
                searchId: 1,
                roomId: room.roomId,
                term: "search term",
                scope: SearchScope.All,
                promise: Promise.resolve({
                    results: [
                        SearchResult.fromJson(
                            {
                                rank: 1,
                                result: {
                                    content: {
                                        body: "search term",
                                        msgtype: "m.text",
                                    },
                                    type: "m.room.message",
                                    event_id: "$eventId",
                                    sender: cli.getSafeUserId(),
                                    origin_server_ts: 123456789,
                                    room_id: room2.roomId,
                                },
                                context: {
                                    events_before: [],
                                    events_after: [],
                                    profile_info: {},
                                },
                            },
                            eventMapper,
                        ),
                    ],
                    highlights: [],
                    count: 1,
                }),
                inProgress: false,
                count: 1,
            },
        });

        await waitFor(() => {
            expect(container.querySelector(".mx_RoomView_searchResultsPanel")).toBeVisible();
        });
        const prom = untilDispatch(Action.ViewRoom, dis);

        await userEvent.hover(getByText("search term"));
        await userEvent.click(await findByLabelText("Edit"));

        await expect(prom).resolves.toEqual(expect.objectContaining({ room_id: room2.roomId }));
    });

    it("fires Action.RoomLoaded", async () => {
        jest.spyOn(dis, "dispatch");
        await mountRoomView();
        expect(dis.dispatch).toHaveBeenCalledWith({ action: Action.RoomLoaded });
    });
});
