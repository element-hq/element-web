/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type RefObject } from "react";
import { mocked, type MockedObject } from "jest-mock";
import {
    EventTimeline,
    EventType,
    type IEvent,
    JoinRule,
    type MatrixClient,
    MatrixError,
    MatrixEvent,
    Room,
    RoomEvent,
    RoomMember,
    RoomStateEvent,
    SearchOrderBy,
    SearchResult,
} from "matrix-js-sdk/src/matrix";
import { type CryptoApi, CryptoEvent, UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";
import { KnownMembership } from "matrix-js-sdk/src/types";
import {
    act,
    cleanup,
    fireEvent,
    render,
    type RenderResult,
    screen,
    waitFor,
    within,
    findByRole,
} from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import {
    createTestClient,
    emitPromise,
    filterConsole,
    flushPromises,
    mkEvent,
    mkRoomMemberJoinEvent,
    mkThirdPartyInviteEvent,
    mockPlatformPeg,
    setupAsyncStoreWithClient,
    stubClient,
    unmockPlatformPeg,
    untilDispatch,
} from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { Action } from "../../../../src/dispatcher/actions";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../../src/dispatcher/payloads/ViewRoomPayload";
import { type SearchMatchStepPayload } from "../../../../src/dispatcher/payloads/SearchMatchStepPayload";
import { RoomView } from "../../../../src/components/structures/RoomView";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { NotificationState } from "../../../../src/stores/notifications/NotificationState";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import { type LocalRoom, LocalRoomState } from "../../../../src/models/LocalRoom";
import { DirectoryMember } from "../../../../src/utils/direct-messages";
import { createDmLocalRoom } from "../../../../src/utils/dm/createDmLocalRoom";
import { UPDATE_EVENT } from "../../../../src/stores/AsyncStore";
import { SDKContext, SdkContextClass } from "../../../../src/contexts/SDKContext";
import WidgetUtils from "../../../../src/utils/WidgetUtils";
import { WidgetType } from "../../../../src/widgets/WidgetType";
import WidgetStore from "../../../../src/stores/WidgetStore";
import { type ViewRoomErrorPayload } from "../../../../src/dispatcher/payloads/ViewRoomErrorPayload";
import { type SearchInfo, SearchScope } from "../../../../src/Searching";
import { SearchSessionStore } from "../../../../src/stores/SearchSessionStore";
import { MEGOLM_ENCRYPTION_ALGORITHM } from "../../../../src/utils/crypto";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { type ViewUserPayload } from "../../../../src/dispatcher/payloads/ViewUserPayload.ts";
import { CallStore } from "../../../../src/stores/CallStore.ts";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../../../src/MediaDeviceHandler.ts";
import Modal, { type ComponentProps } from "../../../../src/Modal.tsx";
import ErrorDialog from "../../../../src/components/views/dialogs/ErrorDialog.tsx";
import * as pinnedEventHooks from "../../../../src/hooks/usePinnedEvents";
import { TimelineRenderingType } from "../../../../src/contexts/RoomContext";
import { ModuleApi } from "../../../../src/modules/Api";
import MatrixClientBackedController from "../../../../src/settings/controllers/MatrixClientBackedController.ts";
import { type ComposerInsertPayload, ComposerType } from "../../../../src/dispatcher/payloads/ComposerInsertPayload.ts";

// Used by group calls
jest.spyOn(MediaDeviceHandler, "getDevices").mockResolvedValue({
    [MediaDeviceKindEnum.AudioInput]: [],
    [MediaDeviceKindEnum.VideoInput]: [],
    [MediaDeviceKindEnum.AudioOutput]: [],
});

describe("RoomView", () => {
    let cli: MockedObject<MatrixClient>;
    let room: Room;
    let rooms: Map<string, Room>;
    let stores: SdkContextClass;
    let crypto: CryptoApi;

    // mute some noise
    filterConsole("RVS update", "does not have an m.room.create event", "Current version: 1", "Version capability");

    beforeEach(() => {
        mockPlatformPeg({ reload: () => {} });
        cli = mocked(stubClient());
        MatrixClientBackedController.matrixClient = cli;

        const roomName = (expect.getState().currentTestName ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

        room = new Room(`!${roomName}:example.org`, cli, "@alice:example.org");
        jest.spyOn(room, "findPredecessor");
        room.getPendingEvents = () => [];
        rooms = new Map();
        rooms.set(room.roomId, room);
        cli.getRoom.mockImplementation((roomId: string | undefined) => rooms.get(roomId || "") || null);
        cli.getRooms.mockImplementation(() => [...rooms.values()]);
        // Re-emit certain events on the mocked client
        room.on(RoomEvent.Timeline, (...args) => cli.emit(RoomEvent.Timeline, ...args));
        room.on(RoomEvent.TimelineReset, (...args) => cli.emit(RoomEvent.TimelineReset, ...args));

        DMRoomMap.makeShared(cli);
        stores = new SdkContextClass();
        stores.client = cli;
        stores.rightPanelStore.useUnitTestClient(cli);

        crypto = cli.getCrypto()!;
        jest.spyOn(cli, "getCrypto").mockReturnValue(undefined);
    });

    afterEach(() => {
        unmockPlatformPeg();
        jest.clearAllMocks();

        // The SearchSessionStore is a singleton that outlives each test; reset it so a search session never leaks
        // into the next test (abort:false so we don't reject a still-pending mock promise).
        SearchSessionStore.instance.clear({ abort: false });

        // Can't jest.restoreAllMocks() because some tests will break
        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockRestore();
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockRestore();

        cleanup();
    });

    // Seed a completed search the way RoomView.onSearch would (the session now lives in the SearchSessionStore, so
    // a directly-setState'd `search` no longer populates the store-backed match stepper on its own). RoomSearchView
    // then resolves the promise and onSearchUpdate fills in the matches. This mirrors onSearch INCLUDING its
    // resetFocusedEvent step — a flag-guarded no-event ViewRoom that drops any event the timeline was pinned to —
    // so the result-click clear gate behaves the same as in production.
    const startSearch = (ref: RefObject<RoomView | null>, search: SearchInfo): void => {
        act(() => {
            SearchSessionStore.instance.start({
                searchId: search.searchId,
                roomId: search.roomId,
                term: search.term,
                scope: search.scope,
                promise: search.promise,
                abortController: search.abortController ?? new AbortController(),
            });
            ref.current!.setState({ timelineRenderingType: TimelineRenderingType.Search, search });
            const focusedEventId = stores.roomViewStore.getInitialEventId();
            if (focusedEventId) {
                SearchSessionStore.instance.beginSteppingJump(focusedEventId);
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    metricsTrigger: undefined,
                });
            }
        });
    };

    const mountRoomView = async (
        ref?: RefObject<RoomView | null>,
        props?: Partial<ComponentProps<typeof RoomView>>,
    ): Promise<RenderResult> => {
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

            act(() =>
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    metricsTrigger: undefined,
                }),
            );

            await switchedRoom;
        }

        const roomView = render(
            <RoomView
                // threepidInvite should be optional on RoomView props
                // it is treated as optional in RoomView
                threepidInvite={undefined as any}
                forceTimeline={false}
                ref={ref}
                {...props}
            />,
            {
                wrapper: ({ children }) => (
                    <MatrixClientContext.Provider value={cli}>
                        <SDKContext.Provider value={stores}>{children}</SDKContext.Provider>
                    </MatrixClientContext.Provider>
                ),
            },
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
            <MatrixClientContext.Provider value={cli}>
                <SDKContext.Provider value={stores}>
                    <RoomView
                        // threepidInvite should be optional on RoomView props
                        // it is treated as optional in RoomView
                        threepidInvite={undefined}
                        forceTimeline={false}
                        onRegistered={jest.fn()}
                    />
                </SDKContext.Provider>
            </MatrixClientContext.Provider>,
        );
        await flushPromises();
        return roomView;
    };
    const getRoomViewInstance = async (): Promise<RoomView> => {
        const ref = createRef<RoomView>();
        await mountRoomView(ref);
        return ref.current!;
    };

    describe("Telegram-style search header", () => {
        it("opens the top search header on FocusMessageSearch and hides it on cancel", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);
            const ref = createRef<RoomView>();
            await mountRoomView(ref);
            expect(ref.current).toBeTruthy();

            // The normal room header is shown initially — no top search bar.
            expect(screen.queryByTestId("room-search-header")).not.toBeInTheDocument();
            expect(ref.current!.state.searchHeaderActive).toBeFalsy();

            // Cmd+F dispatches FocusMessageSearch -> the top search bar replaces the header.
            act(() => {
                defaultDispatcher.fire(Action.FocusMessageSearch);
            });
            await waitFor(() => expect(screen.getByTestId("room-search-header")).toBeInTheDocument());
            expect(ref.current!.state.searchHeaderActive).toBe(true);

            // Cancelling restores the normal header.
            await userEvent.click(
                within(screen.getByTestId("room-search-header")).getByRole("button", { name: "Cancel" }),
            );
            await waitFor(() => expect(screen.queryByTestId("room-search-header")).not.toBeInTheDocument());
            expect(ref.current!.state.searchHeaderActive).toBe(false);
        });

        it("shows the results dropdown and jumps to the live timeline when a row is clicked", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);
            const ref = createRef<RoomView>();
            const { container } = await mountRoomView(ref);
            expect(ref.current).toBeTruthy();

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            startSearch(ref, {
                searchId: 7,
                roomId: room.roomId,
                term: "gemini",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [
                        SearchResult.fromJson(
                            {
                                rank: 1,
                                result: {
                                    content: { body: "gemini hit", msgtype: "m.text" },
                                    type: "m.room.message",
                                    event_id: "$hit",
                                    sender: "@alice:example.org",
                                    origin_server_ts: 5000,
                                    room_id: room.roomId,
                                },
                                context: { events_before: [], events_after: [], profile_info: {} },
                            },
                            eventMapper,
                        ),
                    ],
                    highlights: [],
                    count: 1,
                }) as unknown as SearchInfo["promise"],
            });

            // Once the promise settles, onSearchUpdate fills `previews` and the dropdown row appears.
            const dropdown = await waitFor(() => {
                const el = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
                expect(within(el).getByText("gemini hit")).toBeInTheDocument();
                return el;
            });

            // Clicking the dropdown row jumps the live timeline to that match (ViewRoom by event id + cursor set).
            const prom = untilDispatch(Action.ViewRoom, defaultDispatcher);
            await userEvent.click(within(dropdown).getByText("gemini hit"));
            await expect(prom).resolves.toEqual(expect.objectContaining({ event_id: "$hit" }));
            expect(ref.current!.state.search!.currentMatchIndex).toBe(0);
        });

        it("syncs the SearchSessionStore cursor to the clicked row so the counter and Enter-stepping anchor on it", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);
            const ref = createRef<RoomView>();
            const { container } = await mountRoomView(ref);
            expect(ref.current).toBeTruthy();

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const mkResult = (eventId: string, body: string, ts: number): SearchResult =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            content: { body, msgtype: "m.text" },
                            type: "m.room.message",
                            event_id: eventId,
                            sender: "@alice:example.org",
                            origin_server_ts: ts,
                            room_id: room.roomId,
                        },
                        context: { events_before: [], events_after: [], profile_info: {} },
                    },
                    eventMapper,
                );
            // Two results; newest-first ordering puts $newer at row 0 and $older at row 1.
            startSearch(ref, {
                searchId: 9,
                roomId: room.roomId,
                term: "gemini",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [mkResult("$newer", "newer hit", 5000), mkResult("$older", "older hit", 4000)],
                    highlights: [],
                    count: 2,
                }) as unknown as SearchInfo["promise"],
            });

            const dropdown = await waitFor(() => {
                const el = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
                expect(within(el).getByText("older hit")).toBeInTheDocument();
                return el;
            });

            // Click the SECOND row ($older, index 1).
            const prom = untilDispatch(Action.ViewRoom, defaultDispatcher);
            await userEvent.click(within(dropdown).getByText("older hit"));
            await expect(prom).resolves.toEqual(expect.objectContaining({ event_id: "$older" }));

            // The shared store cursor must move to the clicked index (1), not stay at -1 — this is what drives the
            // store-backed "k of N" counter and the anchor for a subsequent Enter-step. Before the fix it stayed -1,
            // so the counter read "0 of 2" and the next Enter restarted stepping from the newest match.
            expect(SearchSessionStore.instance.currentMatchIndex).toBe(1);
            // The header counter therefore reflects the clicked result (1-based): "2 of 2".
            await screen.findByText("2 of 2", { exact: false });
        });

        it("keeps the live timeline visible behind the bounded results dropdown", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);
            const ref = createRef<RoomView>();
            const { container } = await mountRoomView(ref);
            expect(ref.current).toBeTruthy();

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            startSearch(ref, {
                searchId: 8,
                roomId: room.roomId,
                term: "gemini",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [
                        SearchResult.fromJson(
                            {
                                rank: 1,
                                result: {
                                    content: { body: "gemini hit", msgtype: "m.text" },
                                    type: "m.room.message",
                                    event_id: "$hit",
                                    sender: "@alice:example.org",
                                    origin_server_ts: 5000,
                                    room_id: room.roomId,
                                },
                                context: { events_before: [], events_after: [], profile_info: {} },
                            },
                            eventMapper,
                        ),
                    ],
                    highlights: [],
                    count: 1,
                }) as unknown as SearchInfo["promise"],
            });

            await waitFor(() => {
                const el = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
                expect(within(el).getByText("gemini hit")).toBeInTheDocument();
            });

            // The old full-list results view is isolated as a hidden data engine...
            expect(container.querySelector(".mx_RoomView_searchDataEngine")).toBeInTheDocument();
            // ...and the live conversation timeline is NOT hidden (no display:none), so it shows behind the dropdown.
            const livePanel = container.querySelector(
                ".mx_RoomView_messagePanel:not(.mx_RoomView_messagePanelSearchSpinner)",
            ) as HTMLElement | null;
            expect(livePanel).toBeTruthy();
            expect(livePanel!.style.display).not.toBe("none");
        });
    });

    describe("in-room search match stepping", () => {
        it("steps to the next match when a SearchMatchStep(next) action is dispatched", async () => {
            const instance = await getRoomViewInstance();
            // Guard against test-isolation pollution: a cross-test leak elsewhere in this large suite can leave
            // the mount returning null, which would otherwise surface as a cryptic property-of-null deref below.
            expect(instance).toBeTruthy();
            const nextSpy = jest.spyOn(instance.searchNavVm, "next");
            const previousSpy = jest.spyOn(instance.searchNavVm, "previous");

            act(() => {
                defaultDispatcher.dispatch<SearchMatchStepPayload>({
                    action: Action.SearchMatchStep,
                    direction: "next",
                });
            });
            await flushPromises();

            expect(nextSpy).toHaveBeenCalledTimes(1);
            expect(previousSpy).not.toHaveBeenCalled();
        });

        it("steps to the previous match when a SearchMatchStep(previous) action is dispatched", async () => {
            const instance = await getRoomViewInstance();
            expect(instance).toBeTruthy();
            const nextSpy = jest.spyOn(instance.searchNavVm, "next");
            const previousSpy = jest.spyOn(instance.searchNavVm, "previous");

            act(() => {
                defaultDispatcher.dispatch<SearchMatchStepPayload>({
                    action: Action.SearchMatchStep,
                    direction: "previous",
                });
            });
            await flushPromises();

            expect(previousSpy).toHaveBeenCalledTimes(1);
            expect(nextSpy).not.toHaveBeenCalled();
        });

        // NB: these heavier mount-based stepping tests live here, in the early describe, rather than in
        // "message search" below: a pre-existing cross-test isolation leak in this large suite leaves a
        // client-less RoomView re-rendering (and crashing in shouldEncryptRoomWithSingle3rdPartyInvite) for
        // whichever mount-heavy test runs last among the later describes. Running early keeps state clean.
        it("steps into a predecessor-room match (cross-room) via the SearchSessionStore", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            // A room-scoped search of an upgraded room also searches its predecessor chain (#32258), so the
            // completed result set can contain matches that live in a *different* room. The session now lives in the
            // SearchSessionStore, which survives RoomView being re-mounted for the predecessor room — so these
            // cross-room matches ARE steppable (the slice-4 current-room filter is gone): stepping into one
            // dispatches ViewRoom for the predecessor room.
            const predRoom = new Room("!predecessor:example.org", cli, "@alice:example.org");
            rooms.set(predRoom.roomId, predRoom);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (roomId: string, eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [
                        makeResult(room.roomId, "$current", "current match", 2),
                        makeResult(predRoom.roomId, "$predecessor", "predecessor match", 1),
                    ],
                    highlights: [],
                    count: 2,
                }),
            });

            // Both matches are now steppable; the store holds the full, unfiltered cross-room match list.
            await screen.findByText("0 of 2", { exact: false });
            expect(SearchSessionStore.instance.matches).toHaveLength(2);

            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
            // Step to the newest ($current, this room) then the older ($predecessor, the predecessor room).
            await userEvent.click(screen.getByRole("button", { name: "Next match" }));
            await screen.findByText("1 of 2", { exact: false });
            await userEvent.click(screen.getByRole("button", { name: "Next match" }));
            await screen.findByText("2 of 2", { exact: false });

            // Stepping into the predecessor match dispatches ViewRoom for the *predecessor* room — in the real app
            // this re-mounts the room-id-keyed RoomView, which re-hydrates the stepper from the store.
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                    room_id: predRoom.roomId,
                    event_id: "$predecessor",
                    highlighted: true,
                    scroll_into_view: true,
                }),
            );
        });

        it("steps to an older match by dispatching ViewRoom by event id and keeps the search session alive", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$newer", "newer match", 2), makeResult("$older", "older match", 1)],
                    highlights: [],
                    count: 2,
                }),
            });

            await screen.findByText("0 of 2", { exact: false });
            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");

            // Step to the older match. The stepper jumps purely by event id: it dispatches ViewRoom with
            // highlighted/scroll_into_view — the input the SDK's existing TimelineWindow contextual load (the
            // permalink/reply-jump path, shared with E2EE/Seshat decryption) consumes to fetch a hit that may be
            // outside the loaded window. This test pins the dispatch contract + session survival only; the actual
            // back-pagination lives in matrix-js-sdk (and is mocked away here), so it is not asserted.
            await userEvent.click(screen.getByRole("button", { name: "Next match" })); // -> $newer (index 0)
            await screen.findByText("1 of 2", { exact: false });
            await userEvent.click(screen.getByRole("button", { name: "Next match" })); // -> $older (index 1)
            await screen.findByText("2 of 2", { exact: false });

            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    event_id: "$older",
                    highlighted: true,
                    scroll_into_view: true,
                }),
            );
            // The search session survives stepping to the older match (Room timeline, cursor advanced).
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Room);
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(roomViewRef.current!.state.search!.currentMatchIndex).toBe(1);
        });

        it("returns from stepping to the results list without tearing down the search session", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$newer", "newer match", 2), makeResult("$older", "older match", 1)],
                    highlights: [],
                    count: 2,
                }),
            });

            await screen.findByText("0 of 2", { exact: false });
            // Step into the live timeline (Room mode), then return to the results list via the affordance.
            await userEvent.click(screen.getByRole("button", { name: "Next match" }));
            await screen.findByText("1 of 2", { exact: false });
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Room);

            await userEvent.click(screen.getByRole("button", { name: "Back to results" }));

            // The stepper cursor is reset, so the "k of N loaded" counter reads "0 of N" again.
            await screen.findByText("0 of 2", { exact: false });
            // Back in Search mode (results list re-renders) with no active match, but the search session — term,
            // promise, navigation VM — is preserved (distinct from cancelling, which clears `search` entirely).
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Search);
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(roomViewRef.current!.state.search!.currentMatchIndex).toBeUndefined();
        });

        it("keeps the search alive when a RoomViewStore update races the return-to-results transition (dropdown reset bug)", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$newer", "newer match", 2), makeResult("$older", "older match", 1)],
                    highlights: [],
                    count: 2,
                }),
            });

            await screen.findByText("0 of 2", { exact: false });

            // Step into the newest match: the live timeline (Room mode) is pinned to $newer.
            await userEvent.click(screen.getByRole("button", { name: "Next match" }));
            await screen.findByText("1 of 2", { exact: false });
            expect(stores.roomViewStore.getInitialEventId()).toBe("$newer");

            // Return to the results list. onBackToSearchResults flips back to Search mode and resetFocusedEvent
            // dispatches an ASYNC (window.setTimeout) clearing ViewRoom — so for the whole window before it lands, the
            // live timeline is still pinned to $newer while we are already back in Search mode showing the dropdown.
            fireEvent.click(screen.getByRole("button", { name: "Back to results" }));
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Search);
            expect(stores.roomViewStore.getInitialEventId()).toBe("$newer");
            // The durable guard records the still-pinned match and survives the return-to-results re-render (which
            // re-mounts RoomSearchView and re-fires updateResults) — without this it was nulled and the gate reset.
            expect(SearchSessionStore.instance.steppingTarget).toBe("$newer");

            // Model the packaged-desktop race jsdom never produces on its own: a background RoomViewStore emission
            // (sync / read receipts / the sliding-sync re-dispatch) lands in that window and consumes the one-shot
            // stepping-jump flag, then the next emission re-evaluates the clear gate while $newer is still pinned.
            // Microtask-only flush (no flushPromises, which would run the pending clearing ViewRoom macrotask and null
            // the focus), so $newer remains the focused event the gate sees.
            await act(async () => {
                SearchSessionStore.instance.consumeSteppingJump(); // an unrelated update consumed the flag early
                stores.roomViewStore.emit(UPDATE_EVENT); // the next unrelated update re-evaluates the clear gate
            });

            // The session must survive: pre-fix the clear gate fired and tore it down — the user's "it resets itself".
            // With the durable guard kept across the WHOLE return-to-results transition (never dropped on a transient
            // un-pinned frame), survival no longer hinges on the exact moment the async clearing ViewRoom lands.
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);

            // Drain any deferred clearing ViewRoom so its timer can't leak into the next test; the session stays alive
            // once the timeline has fully un-pinned.
            await flushPromises();
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);
        });

        it("keeps the search alive when a background RoomViewStore update races a result-row click before its jump lands", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            const { container } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$newer", "newer match", 2), makeResult("$older", "older match", 1)],
                    highlights: [],
                    count: 2,
                }),
            });

            // Wait for the Telegram-style results dropdown to render its rows.
            const dropdown = await waitFor(() => {
                const el = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
                expect(within(el).getByText("newer match")).toBeInTheDocument();
                return el;
            });

            // Click a result ROW. onActivateSearchMatch arms the durable guard (steppingTarget=$newer), flips to the
            // live timeline (Room mode) and dispatches an ASYNC (window.setTimeout) ViewRoom($newer). A synchronous
            // fireEvent keeps that jump PENDING — no macrotask flush — so the live timeline is NOT yet pinned: exactly
            // the packaged-build window where constant background RoomViewStore emissions arrive before our own jump
            // has landed (jsdom produces none on its own, which is why the prior tests never caught this).
            fireEvent.click(within(dropdown).getByText("newer match"));
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Room);
            expect(stores.roomViewStore.getInitialEventId()).toBeNull();
            expect(SearchSessionStore.instance.steppingTarget).toBe("$newer");

            // A background emission (sync / read receipts / setViewRoomOpts on RoomLoaded) lands in that window. It
            // must NOT unguard the durable target merely because the live timeline is transiently un-pinned while our
            // own jump is still queued. Pre-fix, the clear gate's else-branch nulled steppingTarget right here — the
            // single defect behind the "search resets itself" report.
            await act(async () => {
                stores.roomViewStore.emit(UPDATE_EVENT);
            });
            expect(SearchSessionStore.instance.steppingTarget).toBe("$newer");

            // The user reopens the list (clicks the search box / back-to-results) BEFORE the jump has landed. This
            // flips to Search mode; resetFocusedEvent no-ops because nothing is pinned yet, so it cannot re-arm the
            // guard. The session's survival now rests entirely on the guard never having been nulled above.
            fireEvent.click(screen.getByRole("button", { name: "Back to results" }));
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Search);

            // Drain the deferred ViewRoom($newer): it finally pins the live timeline while we are in Search mode. The
            // clear gate must recognise $newer as our own navigation (it equals the durable target) and leave the
            // session intact — pre-fix the target was null here so the gate fired clear({abort:true}) and tore the
            // search down to an empty bar ("it resets itself").
            await flushPromises();
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);
        });

        // Returning to the results list must leave the live timeline anchored to the LAST-VIEWED
        // match, so the conversation stays on the message the user was just reading. Two earlier symptoms were both
        // wrong derivations of this pin: pre-8d, `getInitialEventId() ?? this.state.initialEventId` resurrected a
        // stale earlier match on a background emission → reopening jumped to the FIRST-clicked result. The 8d fix
        // over-corrected to `undefined`, un-pinning the timeline so it fell to the live bottom → reopening jumped to
        // the LATEST message. The durable fix pins to SearchSessionStore.steppingTarget — the match we returned from.
        it("keeps the live timeline anchored to the last-viewed match when returning to the results list", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );
            // Resolve the matched events locally so onRoomViewStoreUpdate pins synchronously (no fetchInitialEvent).
            const matchEvents: Record<string, MatrixEvent> = {
                $newer: eventMapper({ event_id: "$newer", room_id: room.roomId, type: EventType.RoomMessage }),
                $older: eventMapper({ event_id: "$older", room_id: room.roomId, type: EventType.RoomMessage }),
            };
            jest.spyOn(room, "findEventById").mockImplementation((id: string) => matchEvents[id]);

            const roomViewRef = createRef<RoomView>();
            const { container } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$newer", "newer match", 2), makeResult("$older", "older match", 1)],
                    highlights: [],
                    count: 2,
                }),
            });

            const dropdown = await waitFor(() => {
                const el = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
                expect(within(el).getByText("older match")).toBeInTheDocument();
                return el;
            });

            // Click a result row → the live timeline pins to that match (store + local mirror).
            await userEvent.click(within(dropdown).getByText("older match"));
            await waitFor(() => expect(stores.roomViewStore.getInitialEventId()).toBe("$older"));
            await waitFor(() => expect(roomViewRef.current!.state.initialEventId).toBe("$older"));

            // Return to the list. The STORE focused event un-pins (so a re-click of the same row still registers in
            // the clear gate), but the LOCAL mirror must stay on $older — the anchor — so reopening the list does not
            // move the conversation to the latest message or to an earlier result.
            await userEvent.click(screen.getByRole("button", { name: "Back to results" }));
            await waitFor(() => expect(stores.roomViewStore.getInitialEventId()).toBeNull());
            expect(roomViewRef.current!.state.initialEventId).toBe("$older");
            expect(SearchSessionStore.instance.steppingTarget).toBe("$older");
        });

        it("keeps the conversation on the last-viewed match when a background update races returning to the list", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );
            const matchEvents: Record<string, MatrixEvent> = {
                $newer: eventMapper({ event_id: "$newer", room_id: room.roomId, type: EventType.RoomMessage }),
                $older: eventMapper({ event_id: "$older", room_id: room.roomId, type: EventType.RoomMessage }),
            };
            jest.spyOn(room, "findEventById").mockImplementation((id: string) => matchEvents[id]);

            const roomViewRef = createRef<RoomView>();
            const { container } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$newer", "newer match", 2), makeResult("$older", "older match", 1)],
                    highlights: [],
                    count: 2,
                }),
            });

            const dropdown = await waitFor(() => {
                const el = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
                expect(within(el).getByText("older match")).toBeInTheDocument();
                return el;
            });

            // Pin the live timeline to $older.
            await userEvent.click(within(dropdown).getByText("older match"));
            await waitFor(() => expect(stores.roomViewStore.getInitialEventId()).toBe("$older"));

            // Click "Back to results": resetFocusedEvent queues an ASYNC no-event ViewRoom, so the store still holds
            // $older until it lands. A synchronous fireEvent keeps that un-pin pending — the packaged-build window.
            fireEvent.click(screen.getByRole("button", { name: "Back to results" }));
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Search);
            expect(stores.roomViewStore.getInitialEventId()).toBe("$older");

            // A background RoomViewStore emission lands in that window. While the results list is shown the live
            // timeline must stay anchored to the last-viewed match ($older) — NOT the first result and NOT the live
            // bottom (undefined → latest message). The anchor is the durable steppingTarget, immune to the lagged
            // store value and to any stale local mirror.
            await act(async () => {
                stores.roomViewStore.emit(UPDATE_EVENT);
            });
            expect(roomViewRef.current!.state.initialEventId).toBe("$older");

            await flushPromises();
            expect(roomViewRef.current!.state.initialEventId).toBe("$older");
        });

        // The reported regression was a MULTI-click one — view several results, reopen the list,
        // and it jumped back to the FIRST-clicked result (later, to the LATEST message). The anchor must always track
        // the MOST-RECENTLY-viewed match, never an earlier one and never the live bottom.
        it("anchors the list to the most-recently-viewed match after several result clicks", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );
            const matchEvents: Record<string, MatrixEvent> = {
                $newer: eventMapper({ event_id: "$newer", room_id: room.roomId, type: EventType.RoomMessage }),
                $older: eventMapper({ event_id: "$older", room_id: room.roomId, type: EventType.RoomMessage }),
            };
            jest.spyOn(room, "findEventById").mockImplementation((id: string) => matchEvents[id]);

            const roomViewRef = createRef<RoomView>();
            const { container } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$newer", "newer match", 2), makeResult("$older", "older match", 1)],
                    highlights: [],
                    count: 2,
                }),
            });

            const dropdown = await waitFor(() => {
                const el = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
                expect(within(el).getByText("older match")).toBeInTheDocument();
                return el;
            });

            // View $older, return to the list — the anchor is $older.
            await userEvent.click(within(dropdown).getByText("older match"));
            await waitFor(() => expect(roomViewRef.current!.state.initialEventId).toBe("$older"));
            await userEvent.click(screen.getByRole("button", { name: "Back to results" }));
            expect(roomViewRef.current!.state.initialEventId).toBe("$older");

            // Now view $newer, return to the list — the anchor must FOLLOW to $newer, not stick on the first-clicked
            // $older (the original "jumps to first result" bug).
            const dropdown2 = await waitFor(() => {
                const el = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
                expect(within(el).getByText("newer match")).toBeInTheDocument();
                return el;
            });
            await userEvent.click(within(dropdown2).getByText("newer match"));
            await waitFor(() => expect(roomViewRef.current!.state.initialEventId).toBe("$newer"));
            await userEvent.click(screen.getByRole("button", { name: "Back to results" }));
            expect(roomViewRef.current!.state.initialEventId).toBe("$newer");
            expect(SearchSessionStore.instance.steppingTarget).toBe("$newer");
        });

        // Clicking a result must land the conversation on the match WITH the jump flash
        // (isInitialEventHighlighted), the centered scroll (initialEventScrollIntoView) and the live in-bubble term
        // highlight (stepping) — and KEEP them when the async search settles (or a "load more" page lands) while the
        // match is focused. Pre-fix, that settled onSearchUpdate nulled the volatile cursor, so a constant background
        // RoomViewStore emission (packaged build) made onRoomViewStoreUpdate treat the focused jump as "results list
        // shown" and clobber isInitialEventHighlighted -> false, drop the stepping render (no term highlight) and
        // re-show the dropdown over the timeline — the user saw no blink, no highlight, message stranded at the
        // bottom. The durable SearchSessionStore.focusedMatch keeps stepping alive across that race.
        it("keeps the clicked match flashed + scrolled + pinned when a search update races mid-step", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );
            // Resolve the matched events locally so onRoomViewStoreUpdate pins synchronously (no fetchInitialEvent).
            const matchEvents: Record<string, MatrixEvent> = {
                $newer: eventMapper({ event_id: "$newer", room_id: room.roomId, type: EventType.RoomMessage }),
                $older: eventMapper({ event_id: "$older", room_id: room.roomId, type: EventType.RoomMessage }),
            };
            jest.spyOn(room, "findEventById").mockImplementation((id: string) => matchEvents[id]);

            const roomViewRef = createRef<RoomView>();
            const { container } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$newer", "newer match", 2), makeResult("$older", "older match", 1)],
                    highlights: ["match"],
                    count: 2,
                }),
            });

            const dropdown = await waitFor(() => {
                const el = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
                expect(within(el).getByText("older match")).toBeInTheDocument();
                return el;
            });

            // Click a result row → jump to the match: pinned, flashed (highlighted) and scrolled into view (centered).
            await userEvent.click(within(dropdown).getByText("older match"));
            await waitFor(() => expect(roomViewRef.current!.state.initialEventId).toBe("$older"));
            expect(roomViewRef.current!.state.isInitialEventHighlighted).toBe(true);
            expect(roomViewRef.current!.state.initialEventScrollIntoView).toBe(true);
            // No pixel offset → TimelinePanel.initTimeline uses offsetBase 0.5, centering the match vertically
            // (the "lands at the bottom instead of centered" symptom).
            expect(roomViewRef.current!.state.initialEventPixelOffset).toBeUndefined();
            expect(SearchSessionStore.instance.focusedMatch).toBe("$older");
            // The results dropdown is hidden while a match is focused (live timeline shown).
            expect(container.querySelector(".mx_RoomSearchResults")).toBeNull();

            // The async search settles AGAIN while the match is focused — onSearchUpdate fires (this is the real
            // packaged-build trigger: the live request resolves at/after the click instant, or a "load more" page
            // lands). It re-derives the cursor onto the focused match rather than nulling it.
            const settledResults = {
                results: [makeResult("$newer", "newer match", 2), makeResult("$older", "older match", 1)],
                highlights: ["match"],
                count: 2,
            };
            await act(async () => {
                (
                    roomViewRef.current as unknown as {
                        onSearchUpdate: (
                            inProgress: boolean,
                            results: typeof settledResults,
                            error: Error | null,
                        ) => void;
                    }
                ).onSearchUpdate(false, settledResults, null);
            });
            // ... then a constant background RoomViewStore emission runs onRoomViewStoreUpdate.
            await act(async () => {
                stores.roomViewStore.emit(UPDATE_EVENT);
            });
            await flushPromises();

            // The focused match stays flashed, pinned and in stepping (live timeline + in-bubble highlight) — the
            // clobber must NOT collapse it to the results list.
            expect(roomViewRef.current!.state.isInitialEventHighlighted).toBe(true);
            expect(roomViewRef.current!.state.initialEventId).toBe("$older");
            expect(SearchSessionStore.instance.focusedMatch).toBe("$older");
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Room);
            expect(container.querySelector(".mx_RoomSearchResults")).toBeNull();
        });

        it("re-hydrates the live stepper from the store when re-mounted for the focused match's room", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            // Simulate the state left after stepping from another room into a match that lives in THIS room: the
            // session is in the SearchSessionStore with the focused match pointing here. A freshly-constructed
            // RoomView (as if re-mounted by LoggedInView for the new room) must re-hydrate its search render state
            // from the store so the header, "k of N" arrows and live highlight reappear without a results-list flash.
            const store = SearchSessionStore.instance;
            store.start({
                searchId: 7,
                roomId: "!origin:example.org", // the search was started from a different room
                term: "match",
                scope: SearchScope.All,
                promise: Promise.resolve({ results: [], highlights: [], count: 2 }),
                abortController: new AbortController(),
            });
            store.updateResults({
                inProgress: false,
                matches: [
                    { roomId: room.roomId, eventId: "$here" },
                    { roomId: "!origin:example.org", eventId: "$origin" },
                ],
                highlights: ["match"],
                count: 2,
            });
            store.setCurrentMatchIndex(0); // focused on the match in THIS room

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            // The fresh RoomView re-hydrated the surviving session: search render state is restored from the store...
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(roomViewRef.current!.state.search!.term).toBe("match");
            expect(roomViewRef.current!.state.search!.currentMatchIndex).toBe(0);
            expect(roomViewRef.current!.state.search!.matches).toHaveLength(2);
            // ...and the header counter renders (1-based) so stepping continues seamlessly.
            await screen.findByText("1 of 2", { exact: false });
        });

        it("re-hydrates the from:/sender filter from the store on re-mount", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            // A cross-room stepping jump re-mounts RoomView; the active sender filter lives in the store and must
            // survive into the rebuilt render state, otherwise the chip loses its selection and a re-search would
            // silently drop the filter.
            const store = SearchSessionStore.instance;
            store.start({
                searchId: 8,
                roomId: "!origin:example.org",
                term: "match",
                scope: SearchScope.All,
                senders: ["@bob:example.org"],
                promise: Promise.resolve({ results: [], highlights: [], count: 1 } as any),
                abortController: new AbortController(),
            });
            // Re-hydration only fires when the focused match points to the room this RoomView mounts for.
            store.updateResults({
                inProgress: false,
                matches: [{ roomId: room.roomId, eventId: "$here" }],
                highlights: ["match"],
                count: 1,
            });
            store.setCurrentMatchIndex(0);

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            expect(roomViewRef.current!.state.search!.senders).toEqual(["@bob:example.org"]);
        });

        it("re-hydrates the result order from the store on re-mount", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            // The chosen result order (recent/relevant) is session identity; a cross-room stepping jump re-mounts
            // RoomView and the order must survive into the rebuilt render state. This guards searchInfoFromSession
            // against dropping `order` — the exact regression that hit the from:/sender filter.
            const store = SearchSessionStore.instance;
            store.start({
                searchId: 9,
                roomId: "!origin:example.org",
                term: "match",
                scope: SearchScope.All,
                order: SearchOrderBy.Rank,
                promise: Promise.resolve({ results: [], highlights: [], count: 1 } as any),
                abortController: new AbortController(),
            });
            store.updateResults({
                inProgress: false,
                matches: [{ roomId: room.roomId, eventId: "$here" }],
                highlights: ["match"],
                count: 1,
            });
            store.setCurrentMatchIndex(0);

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            expect(roomViewRef.current!.state.search!.order).toBe(SearchOrderBy.Rank);
        });

        it("ends the search when a result is clicked (a non-stepping ViewRoom in Search mode)", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({ results: [makeResult("$m1", "m1", 2)], highlights: [], count: 1 }),
            });
            await screen.findByText("0 of 1", { exact: false });
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);
            // The header is active (as it is once the user opens search), so we can prove the gate FULLY closes it.
            act(() => roomViewRef.current!.setState({ searchHeaderActive: true }));

            // Navigating to an event we did not pin (a ViewRoom with an event id, NOT a stepping jump) ends the search:
            // the clear gate fires because no stepping-jump flag was set and the event is not the durable target.
            act(() =>
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    event_id: "$m1",
                    highlighted: true,
                    scroll_into_view: true,
                    metricsTrigger: undefined,
                }),
            );

            await waitFor(() => expect(roomViewRef.current!.state.search).toBeUndefined());
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(false);
            // ...and the search header is fully dismissed (not left as an empty bar over the timeline).
            expect(roomViewRef.current!.state.searchHeaderActive).toBe(false);
        });

        it("re-clicking the last-stepped result after returning to results keeps the search alive", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            const { container } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$m1", "first", 2), makeResult("$m2", "second", 1)],
                    highlights: [],
                    count: 2,
                }),
            });
            await screen.findByText("0 of 2", { exact: false });

            // Step to the first match ($m1) — RoomViewStore.initialEventId becomes $m1.
            await userEvent.click(screen.getByRole("button", { name: "Next match" }));
            await screen.findByText("1 of 2", { exact: false });
            expect(stores.roomViewStore.getInitialEventId()).toBe("$m1");

            // Return to the results list: the still-alive session is preserved and the durable stepping target stays
            // pinned to $m1 (it is dropped only by a new search / cancel), so a subsequent re-click is recognised as
            // our own navigation rather than a navigate-away.
            await userEvent.click(screen.getByRole("button", { name: "Back to results" }));
            await waitFor(() => expect(stores.roomViewStore.getInitialEventId()).toBeNull());
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(SearchSessionStore.instance.steppingTarget).toBe("$m1");

            // Re-click that SAME result row ($m1): per the chosen UX it KEEPS the search open and simply jumps back to
            // the message — it does NOT end the search. The clear gate excludes it because it equals the durable
            // stepping target. (Previously this ended the search; the racy guard-clearing that enabled it was the root
            // of the "resets itself" bug, so the behaviour was intentionally changed.)
            const dropdown = container.querySelector(".mx_RoomSearchResults") as HTMLElement;
            await userEvent.click(within(dropdown).getByText("first"));
            await flushPromises();
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Room);
            expect(stores.roomViewStore.getInitialEventId()).toBe("$m1");
        });

        it("keeps the search alive when clicking the result for the event the search was started on", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            // View event $E first, so the live timeline is pinned to it (e.g. arriving via a permalink/notification).
            act(() =>
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    event_id: "$E",
                    highlighted: true,
                    scroll_into_view: true,
                    metricsTrigger: undefined,
                }),
            );
            await waitFor(() => expect(stores.roomViewStore.getInitialEventId()).toBe("$E"));

            // Start a search (whose results include $E). onSearch drops the focused event so the search isn't pinned.
            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({ results: [makeResult("$E", "the event", 1)], highlights: [], count: 1 }),
            });
            await waitFor(() => expect(stores.roomViewStore.getInitialEventId()).toBeNull());
            await screen.findByText("0 of 1", { exact: false });
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);

            // $E stayed the durable stepping target across the search-open clear (onSearch pins the pre-search focused
            // event to guard the clearing window). Clicking the result for $E is therefore recognised as our own
            // navigation, NOT a navigate-away, so it KEEPS the search alive and simply jumps to it — per the chosen
            // "result clicks keep the session alive" UX. (The racy guard-clearing that used to end it here is exactly
            // what produced the "resets itself" bug.)
            act(() =>
                defaultDispatcher.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    event_id: "$E",
                    highlighted: true,
                    scroll_into_view: true,
                    metricsTrigger: undefined,
                }),
            );
            await flushPromises();
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);
        });

        it("does not abort the in-flight search when RoomView unmounts (the session survives a remount)", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const abortController = new AbortController();
            const roomViewRef = createRef<RoomView>();
            const { unmount } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: new Promise(() => {}), // never settles — stands in for an in-flight request
                abortController,
            });
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);

            // Unmount WITHOUT cancelling (as a cross-room stepping jump re-mounts the room-id-keyed RoomView).
            act(() => unmount());

            // The session and its in-flight request must survive untouched — only an explicit cancel/logout aborts.
            expect(abortController.signal.aborted).toBe(false);
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);
        });

        it("does not close the search on an EditEvent while a stepping jump is in flight", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const matchEvent = eventMapper({
                room_id: room.roomId,
                event_id: "$m1",
                sender: cli.getSafeUserId(),
                origin_server_ts: 2,
                content: { body: "first", msgtype: "m.text" },
                type: EventType.RoomMessage,
            });
            const matchResult = SearchResult.fromJson(
                {
                    rank: 1,
                    result: {
                        room_id: room.roomId,
                        event_id: "$m1",
                        sender: cli.getSafeUserId(),
                        origin_server_ts: 2,
                        content: { body: "first", msgtype: "m.text" },
                        type: EventType.RoomMessage,
                    },
                    context: { profile_info: {}, events_before: [], events_after: [] },
                },
                eventMapper,
            );

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({ results: [matchResult], highlights: [], count: 1 }),
            });
            await screen.findByText("0 of 1", { exact: false });

            // A stepping jump is in flight (flag set, not yet consumed). An EditEvent dispatched in this window must
            // NOT tear the surviving session down (a genuine edit, with no jump in flight, still closes it).
            act(() => {
                SearchSessionStore.instance.beginSteppingJump("$m1");
                defaultDispatcher.dispatch({
                    action: Action.EditEvent,
                    event: matchEvent,
                    timelineRenderingType: roomViewRef.current!.state.timelineRenderingType,
                });
            });

            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(SearchSessionStore.instance.hasActiveSession()).toBe(true);
        });
    });

    it("gets a room view store from MultiRoomViewStore when given a room ID", async () => {
        stores.multiRoomViewStore.getRoomViewStoreForRoom = jest.fn().mockReturnValue(stores.roomViewStore);

        const ref = createRef<RoomView>();
        render(
            <MatrixClientContext.Provider value={cli}>
                <SDKContext.Provider value={stores}>
                    <RoomView
                        threepidInvite={undefined as any}
                        forceTimeline={false}
                        ref={ref}
                        roomId="!room:example.dummy"
                    />
                </SDKContext.Provider>
            </MatrixClientContext.Provider>,
        );

        expect(stores.multiRoomViewStore.getRoomViewStoreForRoom).toHaveBeenCalledWith("!room:example.dummy");
    });

    it("should show member list right panel phase on Action.ViewUser without `payload.member`", async () => {
        const spy = jest.spyOn(stores.rightPanelStore, "showOrHidePhase");
        await renderRoomView(false);

        defaultDispatcher.dispatch<ViewUserPayload>(
            {
                action: Action.ViewUser,
                member: undefined,
            },
            true,
        );

        expect(spy).toHaveBeenCalledWith(RightPanelPhases.MemberList);
    });

    it("when there is no room predecessor, getHiddenHighlightCount should return 0", async () => {
        const instance = await getRoomViewInstance();
        expect(instance.getHiddenHighlightCount()).toBe(0);
    });

    it("should hide the composer when hideComposer=true", async () => {
        // Join the room
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
        const { asFragment } = await mountRoomView(undefined, { hideComposer: true });

        expect(screen.queryByRole("textbox", { name: "Send an unencrypted message…" })).not.toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should hide the header when hideHeader=true", async () => {
        // Join the room
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
        const { asFragment } = await mountRoomView(undefined, { hideHeader: true });

        // Check that the room name button in the header is not rendered
        expect(screen.queryByRole("button", { name: room.name })).not.toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should hide the right panel when hideRightPanel=true", async () => {
        // Join the room
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
        const { asFragment, rerender } = await mountRoomView(undefined);

        defaultDispatcher.dispatch<ViewUserPayload>(
            {
                action: Action.ViewUser,
                member: undefined,
            },
            true,
        );

        // Check that the right panel is rendered
        await expect(screen.findByTestId("right-panel")).resolves.toBeTruthy();
        // Now rerender with hideRightPanel=true
        rerender(<RoomView threepidInvite={undefined} forceTimeline={false} hideRightPanel={true} />);
        // Check that the right panel is not rendered
        await expect(screen.findByTestId("right-panel")).rejects.toThrow();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should hide the pinned message banner when hidePinnedMessageBanner=true", async () => {
        // Join the room
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);

        const pinnedEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            sender: "@alice:example.org",
            content: {
                body: "First pinned message",
                msgtype: "m.text",
            },
            room_id: room.roomId,
            origin_server_ts: 0,
            event_id: "$eventId",
        });

        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([pinnedEvent.getId()!]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([pinnedEvent]);

        const { asFragment, rerender } = await mountRoomView(undefined);
        // Check that the pinned message banner is rendered
        await expect(screen.findByTestId("pinned-message-banner")).resolves.toBeTruthy();
        // Now rerender with hidePinnedMessagesBanner=true
        rerender(<RoomView threepidInvite={undefined} forceTimeline={false} hidePinnedMessageBanner={true} />);
        // Check that the pinned message banner is not rendered
        await expect(screen.findByTestId("pinned-message-banner")).rejects.toThrow();
        expect(asFragment()).toMatchSnapshot();
    });

    describe("enableReadReceiptsAndMarkersOnActivity", () => {
        it.each([
            {
                enabled: false,
                testName: "should send read receipts and update read marker on focus when disabled",
                checkCall: (sendReadReceiptsSpy: jest.Mock, updateReadMarkerSpy: jest.Mock) => {
                    expect(sendReadReceiptsSpy).toHaveBeenCalled();
                    expect(updateReadMarkerSpy).toHaveBeenCalled();
                },
            },
            {
                enabled: true,
                testName: "should not send read receipts and update read marker on focus when enabled",
                checkCall: (sendReadReceiptsSpy: jest.Mock, updateReadMarkerSpy: jest.Mock) => {
                    expect(sendReadReceiptsSpy).not.toHaveBeenCalled();
                    expect(updateReadMarkerSpy).not.toHaveBeenCalled();
                },
            },
        ])("$testName", async ({ enabled, checkCall }) => {
            // Join the room
            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
            const ref = createRef<RoomView>();
            await mountRoomView(ref, {
                enableReadReceiptsAndMarkersOnActivity: enabled,
            });

            // Wait for the timeline to be rendered
            await waitFor(() => expect(screen.getByTestId("timeline")).not.toBeNull());

            // Get the RoomView instance and mock the messagePanel methods
            const instance = ref.current!;
            const sendReadReceiptsSpy = jest.fn();
            const updateReadMarkerSpy = jest.fn();
            // @ts-ignore - accessing private property for testing
            instance.messagePanel = {
                sendReadReceipts: sendReadReceiptsSpy,
                updateReadMarker: updateReadMarkerSpy,
            };

            // Find the main RoomView div and trigger focus
            const timeline = screen.getByTestId("timeline");
            fireEvent.focus(timeline);

            // Verify that sendReadReceipts and updateReadMarker were called or not based on the enabled state
            checkCall(sendReadReceiptsSpy, updateReadMarkerSpy);
        });
    });

    describe("invites", () => {
        beforeEach(() => {
            const member = new RoomMember(room.roomId, cli.getSafeUserId());
            member.membership = KnownMembership.Invite;
            member.events.member = new MatrixEvent({
                sender: "@bob:example.org",
                content: { membership: KnownMembership.Invite },
            });
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Invite);
            room.getMember = jest.fn().mockReturnValue(member);
        });

        it("renders an invite room", async () => {
            const { asFragment } = await mountRoomView();
            expect(asFragment()).toMatchSnapshot();
        });

        it("handles accepting an invite", async () => {
            const { getByRole } = await mountRoomView();

            await fireEvent.click(getByRole("button", { name: "Accept" }));

            await untilDispatch(Action.JoinRoomReady, defaultDispatcher);
        });
        it("handles declining an invite", async () => {
            const { getByRole } = await mountRoomView();
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true, false, false]),
                close: jest.fn(),
            });
            await fireEvent.click(getByRole("button", { name: "Decline" }));
            await waitFor(() => expect(cli.leave).toHaveBeenCalledWith(room.roomId));
            expect(cli.setIgnoredUsers).not.toHaveBeenCalled();
        });
        it("handles declining an invite and ignoring the user", async () => {
            const { getByRole } = await mountRoomView();
            cli.getIgnoredUsers.mockReturnValue(["@carol:example.org"]);
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true, true, false]),
                close: jest.fn(),
            });
            await act(() => fireEvent.click(getByRole("button", { name: "Decline and block" })));
            expect(cli.leave).toHaveBeenCalledWith(room.roomId);
            expect(cli.setIgnoredUsers).toHaveBeenCalledWith(["@carol:example.org", "@bob:example.org"]);
        });
        it("prevents ignoring own user", async () => {
            const member = new RoomMember(room.roomId, cli.getSafeUserId());
            member.membership = KnownMembership.Invite;
            member.events.member = new MatrixEvent({
                /*
                It doesn't matter that this is an invite event coming from own user, we just
                want to simulate a situation where the sender of the membership event somehow
                ends up being own user.
                 */
                sender: cli.getSafeUserId(),
                content: { membership: KnownMembership.Invite },
            });
            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);
            jest.spyOn(room, "getMember").mockReturnValue(member);

            const { getByRole } = await mountRoomView();
            cli.getIgnoredUsers.mockReturnValue(["@carol:example.org"]);
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true, true, false]),
                close: jest.fn(),
            });

            await act(() => fireEvent.click(getByRole("button", { name: "Decline and block" })));

            // Should show error in a modal dialog
            await waitFor(() => {
                expect(Modal.createDialog).toHaveBeenLastCalledWith(ErrorDialog, {
                    title: "Failed to reject invite",
                    description: "Cannot determine which user to ignore since the member event has changed.",
                });
            });

            // The ignore call should not go through
            expect(cli.setIgnoredUsers).not.toHaveBeenCalled();
        });
        it("handles declining an invite and reporting the room", async () => {
            const { getByRole } = await mountRoomView();
            jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: Promise.resolve([true, false, "with a reason"]),
                close: jest.fn(),
            });
            await fireEvent.click(getByRole("button", { name: "Decline and block" }));
            expect(cli.leave).toHaveBeenCalledWith(room.roomId);
            expect(cli.reportRoom).toHaveBeenCalledWith(room.roomId, "with a reason");
        });
    });

    describe("when there is an old room", () => {
        let instance: RoomView;
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
                act(() => instance.setState({ msc3946ProcessDynamicPredecessor: true }));
            });

            afterEach(() => {
                act(() => instance.setState({ msc3946ProcessDynamicPredecessor: false }));
            });

            it("should pass the setting to findPredecessor", async () => {
                expect(instance.getHiddenHighlightCount()).toBe(0);
                expect(room.findPredecessor).toHaveBeenCalledWith(true);
            });
        });
    });

    it("updates url preview visibility on encryption state change", async () => {
        room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);
        jest.spyOn(cli, "getCrypto").mockReturnValue(crypto);
        // we should be starting unencrypted
        expect(await cli.getCrypto()?.isEncryptionEnabledInRoom(room.roomId)).toEqual(false);

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
        jest.spyOn(cli.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);

        // and fake an encryption event into the room to prompt it to re-check
        act(() => {
            const encryptionEvent = new MatrixEvent({
                type: EventType.RoomEncryption,
                sender: cli.getUserId()!,
                content: {},
                event_id: "someid",
                room_id: room.roomId,
            });
            const roomState = room.getLiveTimeline().getState(EventTimeline.FORWARDS)!;
            cli.emit(RoomStateEvent.Events, encryptionEvent, roomState, null);
        });

        // URL previews should now be disabled
        await waitFor(() => expect(roomViewInstance.state.showUrlPreview).toBe(false));
    });

    it("should not display the timeline when the room encryption is loading", async () => {
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
        jest.spyOn(cli, "getCrypto").mockReturnValue(crypto);
        const deferred = Promise.withResolvers<boolean>();
        jest.spyOn(cli.getCrypto()!, "isEncryptionEnabledInRoom").mockImplementation(() => deferred.promise);

        const { asFragment, container } = await mountRoomView();
        expect(container.querySelector(".mx_RoomView_messagePanel")).toBeNull();
        expect(asFragment()).toMatchSnapshot();

        deferred.resolve(true);
        await waitFor(() => expect(container.querySelector(".mx_RoomView_messagePanel")).not.toBeNull());
        expect(asFragment()).toMatchSnapshot();
    });

    it("updates live timeline when a timeline reset happens", async () => {
        const roomViewInstance = await getRoomViewInstance();
        const oldTimeline = roomViewInstance.state.liveTimeline;

        act(() => room.getUnfilteredTimelineSet().resetLiveTimeline());
        expect(roomViewInstance.state.liveTimeline).not.toEqual(oldTimeline);
    });

    it("should update when the e2e status when the user verification changed", async () => {
        room.currentState.setStateEvents([
            mkRoomMemberJoinEvent(cli.getSafeUserId(), room.roomId),
            mkRoomMemberJoinEvent("user@example.com", room.roomId),
        ]);
        room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);
        // Not all the calls to cli.isRoomEncrypted are migrated, so we need to mock both.
        mocked(cli.isRoomEncrypted).mockReturnValue(true);
        jest.spyOn(cli, "getCrypto").mockReturnValue(crypto);
        jest.spyOn(cli.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
        jest.spyOn(cli.getCrypto()!, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false),
        );
        jest.spyOn(cli.getCrypto()!, "getUserDeviceInfo").mockResolvedValue(
            new Map([["user@example.com", new Map<string, any>()]]),
        );

        const { container } = await renderRoomView();
        // We no longer show the grey shield for encrypted rooms, so it should not be there.
        await waitFor(() => expect(container.querySelector(".mx_E2EIcon")).not.toBeInTheDocument());

        const verificationStatus = new UserVerificationStatus(true, true, false);
        jest.spyOn(cli.getCrypto()!, "getUserVerificationStatus").mockResolvedValue(verificationStatus);
        cli.emit(CryptoEvent.UserTrustStatusChanged, cli.getSafeUserId(), verificationStatus);
        await waitFor(() =>
            expect(container.querySelector(".mx_E2EIcon")).toHaveAccessibleName("Everyone in this room is verified"),
        );
    });

    describe("video rooms", () => {
        beforeEach(async () => {
            await setupAsyncStoreWithClient(CallStore.instance, MatrixClientPeg.safeGet());
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

        it("should render joined video room view", async () => {
            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
            const { asFragment } = await mountRoomView();
            expect(asFragment()).toMatchSnapshot();
        });

        it("should open timeline card when navigating to permalink", async () => {
            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
            await mountRoomView();

            stores.rightPanelStore.setCard({ phase: RightPanelPhases.RoomSummary });

            expect(stores.rightPanelStore.isOpen).toEqual(true);
            expect(stores.rightPanelStore.currentCard.phase).not.toEqual(RightPanelPhases.Timeline);

            await stores.roomViewStore.viewRoom({
                action: Action.ViewRoom,
                room_id: stores.roomViewStore.getRoomId()!,
                event_id: "$eventId",
                metricsTrigger: undefined,
            });

            expect(stores.rightPanelStore.isOpen).toEqual(true);
            expect(stores.rightPanelStore.currentCard.phase).toEqual(RightPanelPhases.Timeline);
        });
    });

    describe("group calls", () => {
        beforeEach(async () => {
            await setupAsyncStoreWithClient(CallStore.instance, MatrixClientPeg.safeGet());
            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
        });

        it("hides the right panel chat when closing a call", async () => {
            await mountRoomView();

            // Open the call
            await act(() =>
                stores.roomViewStore.viewRoom({
                    action: Action.ViewRoom,
                    room_id: stores.roomViewStore.getRoomId()!,
                    event_id: "$eventId",
                    metricsTrigger: undefined,
                    view_call: true,
                }),
            );
            // Open the chat in the right panel
            act(() => stores.rightPanelStore.setCard({ phase: RightPanelPhases.Timeline }));
            // Chat should be visible in the right panel
            await findByRole(await screen.findByRole("complementary"), "heading", { name: "Chat" });

            // Close the call
            await act(() =>
                stores.roomViewStore.viewRoom({
                    action: Action.ViewRoom,
                    room_id: stores.roomViewStore.getRoomId()!,
                    event_id: "$eventId",
                    metricsTrigger: undefined,
                    view_call: false,
                }),
            );
            // Right panel should be gone
            expect(screen.queryByRole("complementary")).toBe(null);
            // Opening the right panel again should just show the room summary
            act(() => stores.rightPanelStore.show(room.roomId));
            await findByRole(await screen.findByRole("complementary"), "heading", { name: room.roomId });
        });

        it("hides the right panel chat when returning to a room that previously showed a call", async () => {
            const room2 = new Room(`!roomswitchtest:example.org`, cli, "@alice:example.org");
            rooms.set(room2.roomId, room2);
            await mountRoomView();

            // Open the call
            await act(() =>
                stores.roomViewStore.viewRoom({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    event_id: "$eventId",
                    metricsTrigger: undefined,
                    view_call: true,
                }),
            );
            // Open the chat in the right panel
            act(() => stores.rightPanelStore.setCard({ phase: RightPanelPhases.Timeline }));
            // Chat should be visible in the right panel
            await findByRole(await screen.findByRole("complementary"), "heading", { name: "Chat" });

            // Navigate away to another room
            await act(() =>
                stores.roomViewStore.viewRoom({
                    action: Action.ViewRoom,
                    room_id: room2.roomId,
                    event_id: "$eventId",
                    metricsTrigger: undefined,
                }),
            );
            // Navigate back to the original room
            await act(() =>
                stores.roomViewStore.viewRoom({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    event_id: "$eventId",
                    metricsTrigger: undefined,
                }),
            );
            // Right panel should be gone
            expect(screen.queryByRole("complementary")).toBe(null);
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
                    // Not all the calls to cli.isRoomEncrypted are migrated, so we need to mock both.
                    mocked(cli.isRoomEncrypted).mockReturnValue(true);
                    jest.spyOn(cli, "getCrypto").mockReturnValue(crypto);
                    jest.spyOn(cli.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
                    jest.spyOn(cli.getCrypto()!, "getUserVerificationStatus").mockResolvedValue(
                        new UserVerificationStatus(false, false, false),
                    );
                    localRoom.encrypted = true;
                    localRoom.currentState.setStateEvents([
                        new MatrixEvent({
                            event_id: `~${localRoom.roomId}:${cli.makeTxnId()}`,
                            type: EventType.RoomEncryption,
                            content: {
                                algorithm: MEGOLM_ENCRYPTION_ALGORITHM,
                            },
                            sender: cli.getUserId()!,
                            state_key: "",
                            room_id: localRoom.roomId,
                            origin_server_ts: Date.now(),
                        }),
                    ]);
                });

                it("should match the snapshot", async () => {
                    const { container } = await renderRoomView();
                    await waitFor(() => expect(container).toMatchSnapshot());
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
            jest.spyOn(cli, "getCrypto").mockReturnValue(crypto);
            jest.spyOn(cli.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
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
            expect(screen.queryByText("Send a message…")).not.toBeInTheDocument();
            expect(screen.queryByText("Send an unencrypted message…")).not.toBeInTheDocument();
        });
    });

    it("should show error view if failed to look up room alias", async () => {
        const { asFragment, findByText } = await renderRoomView(false);

        act(() =>
            defaultDispatcher.dispatch<ViewRoomErrorPayload>({
                action: Action.ViewRoomError,
                room_alias: "#addy:server",
                room_id: null,
                err: new MatrixError({ errcode: "M_NOT_FOUND" }),
            }),
        );
        await emitPromise(stores.roomViewStore, UPDATE_EVENT);

        await findByText("Are you sure you're at the right place?");
        expect(asFragment()).toMatchSnapshot();
    });

    describe("knock rooms", () => {
        const client = createTestClient();

        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => setting === "feature_ask_to_join");
            jest.spyOn(room, "getJoinRule").mockReturnValue(JoinRule.Knock);
            jest.spyOn(defaultDispatcher, "dispatch");
        });

        it("allows to request to join", async () => {
            jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client);
            jest.spyOn(client, "knockRoom").mockResolvedValue({ room_id: room.roomId });

            await mountRoomView();
            fireEvent.click(screen.getByRole("button", { name: "Request access" }));
            await untilDispatch(Action.SubmitAskToJoin, defaultDispatcher);

            expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
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
            await untilDispatch(Action.CancelAskToJoin, defaultDispatcher);

            expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                action: "cancel_ask_to_join",
                roomId: room.roomId,
            });
        });
    });

    describe("message search", () => {
        it("should close search results when edit is clicked", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);

            const roomViewRef = createRef<RoomView>();
            const { container, findByLabelText } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());
            // @ts-ignore - triggering a search organically is a lot of work
            act(() =>
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
                }),
            );

            await waitFor(() => {
                expect(container.querySelector(".mx_RoomView_searchResultsPanel")).toBeVisible();
            });

            // Scope to the results panel: the term now also appears in the top-of-chat search bar input.
            const resultsPanel = container.querySelector(".mx_RoomView_searchResultsPanel") as HTMLElement;
            const searchResultTile = within(resultsPanel).getByText("search term").closest(".mx_EventTile");
            expect(searchResultTile).not.toBeNull();

            await userEvent.hover(searchResultTile!);
            await userEvent.click(await findByLabelText("Edit"), { skipHover: true });

            await waitFor(() => {
                expect(container.querySelector(".mx_RoomView_searchResultsPanel")).not.toBeInTheDocument();
            });
        });

        it("should switch rooms when edit is clicked on a search result for a different room", async () => {
            const room2 = new Room(`!roomswitchtest:example.org`, cli, "@alice:example.org");
            rooms.set(room2.roomId, room2);

            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);

            const roomViewRef = createRef<RoomView>();
            const { container, findByLabelText } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());
            // @ts-ignore - triggering a search organically is a lot of work
            act(() =>
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
                }),
            );

            await waitFor(() => {
                expect(container.querySelector(".mx_RoomView_searchResultsPanel")).toBeVisible();
            });
            const prom = untilDispatch(Action.ViewRoom, defaultDispatcher);

            // Scope to the results panel: the term now also appears in the top-of-chat search bar input.
            const resultsPanel = container.querySelector(".mx_RoomView_searchResultsPanel") as HTMLElement;
            const searchResultTile = within(resultsPanel).getByText("search term").closest(".mx_EventTile");
            expect(searchResultTile).not.toBeNull();

            await userEvent.hover(searchResultTile!);
            await userEvent.click(await findByLabelText("Edit"), { skipHover: true });

            await expect(prom).resolves.toEqual(expect.objectContaining({ room_id: room2.roomId }));
        });

        it("should pre-fill search field on FocusMessageSearch dispatch", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const roomViewRef = createRef<RoomView>();
            const { findByPlaceholderText } = await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            act(() =>
                defaultDispatcher.dispatch({
                    action: Action.FocusMessageSearch,
                    initialText: "search term",
                }),
            );

            await expect(findByPlaceholderText("Search messages…")).resolves.toHaveValue("search term");
        });

        it("steps the live timeline to a match and keeps the search session alive", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (eventId: string, body: string) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: room.roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: 1,
                            content: { body, msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            // A completed single-room search drives the stepper organically via onSearchUpdate.
            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({
                    results: [makeResult("$match1", "first match"), makeResult("$match2", "second match")],
                    highlights: [],
                    count: 2,
                }),
            });

            // Once results arrive, the counter + arrows render in the header (browsing, Search render mode).
            await screen.findByText("0 of 2", { exact: false });
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Search);

            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
            await userEvent.click(screen.getByRole("button", { name: "Next match" }));

            // Jumps the live timeline to the first match via the existing ViewRoom path.
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                    room_id: room.roomId,
                    event_id: "$match1",
                    highlighted: true,
                    scroll_into_view: true,
                }),
            );

            // The counter advances, we switch to the live (Room) timeline, and the search session survives the
            // jump rather than being torn down like a clicked result.
            await screen.findByText("1 of 2", { exact: false });
            expect(roomViewRef.current!.state.timelineRenderingType).toBe(TimelineRenderingType.Room);
            expect(roomViewRef.current!.state.search).toBeDefined();
            expect(roomViewRef.current!.state.search!.currentMatchIndex).toBe(0);
        });

        it("re-runs the active search with the from:/sender filter, preserving term and scope", async () => {
            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                promise: Promise.resolve({ results: [], highlights: [], count: 0 } as any),
            });

            // The sender-filter control calls onSearchSendersChange; it must re-run the search keeping the current
            // term + scope, and record the senders on both the session store and the render-state mirror. We invoke
            // the (private) handler directly via the ref — driving it through the full RightPanel UI would add a
            // heavy member-list render for no extra coverage; the store spy + state assertion below prove the wiring.
            const startSpy = jest.spyOn(SearchSessionStore.instance, "start");
            act(() => {
                (
                    roomViewRef.current as unknown as { onSearchSendersChange: (senders: string[]) => void }
                ).onSearchSendersChange(["@bob:example.org"]);
            });

            expect(startSpy).toHaveBeenCalledWith(
                expect.objectContaining({ term: "match", scope: SearchScope.Room, senders: ["@bob:example.org"] }),
            );
            expect(roomViewRef.current!.state.search!.senders).toEqual(["@bob:example.org"]);
        });

        it("re-runs the active search with the chosen order, preserving term, scope and senders", async () => {
            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                senders: ["@bob:example.org"],
                promise: Promise.resolve({ results: [], highlights: [], count: 0 } as any),
            });

            // The order toggle calls onSearchOrderChange; it must re-run the search keeping the current term, scope
            // and sender filter, and record the order on both the session store and the render-state mirror.
            const startSpy = jest.spyOn(SearchSessionStore.instance, "start");
            act(() => {
                (
                    roomViewRef.current as unknown as { onSearchOrderChange: (order: SearchOrderBy) => void }
                ).onSearchOrderChange(SearchOrderBy.Rank);
            });

            expect(startSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    term: "match",
                    scope: SearchScope.Room,
                    senders: ["@bob:example.org"],
                    order: SearchOrderBy.Rank,
                }),
            );
            expect(roomViewRef.current!.state.search!.order).toBe(SearchOrderBy.Rank);
        });

        it("preserves an already-active relevance order across a sender-filter change", async () => {
            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            // Relevance order is already active on the render state.
            startSearch(roomViewRef, {
                searchId: 1,
                roomId: room.roomId,
                term: "match",
                scope: SearchScope.Room,
                order: SearchOrderBy.Rank,
                promise: Promise.resolve({ results: [], highlights: [], count: 0 } as any),
            });

            // Changing the sender filter must NOT reset the order: onSearch defaults `order` from the current
            // session, so the chosen relevance order is carried through (the point of making order session identity).
            const startSpy = jest.spyOn(SearchSessionStore.instance, "start");
            act(() => {
                (
                    roomViewRef.current as unknown as { onSearchSendersChange: (senders: string[]) => void }
                ).onSearchSendersChange(["@bob:example.org"]);
            });

            expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({ order: SearchOrderBy.Rank }));
            expect(roomViewRef.current!.state.search!.order).toBe(SearchOrderBy.Rank);
        });

        it("enables the match stepper for all-rooms searches and steps across rooms", async () => {
            room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

            // All-rooms matches span rooms; the SearchSessionStore survives the cross-room re-mount, so the stepper
            // is enabled for scope=All too (the slice-4 scope===Room gate is gone).
            const otherRoom = new Room("!other:example.org", cli, "@alice:example.org");
            rooms.set(otherRoom.roomId, otherRoom);

            const eventMapper = (obj: Partial<IEvent>) => new MatrixEvent(obj);
            const makeResult = (roomId: string, eventId: string, ts: number) =>
                SearchResult.fromJson(
                    {
                        rank: 1,
                        result: {
                            room_id: roomId,
                            event_id: eventId,
                            sender: cli.getSafeUserId(),
                            origin_server_ts: ts,
                            content: { body: "a match", msgtype: "m.text" },
                            type: EventType.RoomMessage,
                        },
                        context: { profile_info: {}, events_before: [], events_after: [] },
                    },
                    eventMapper,
                );

            const roomViewRef = createRef<RoomView>();
            await mountRoomView(roomViewRef);
            await waitFor(() => expect(roomViewRef.current).toBeTruthy());

            startSearch(roomViewRef, {
                searchId: 1,
                roomId: undefined, // all-rooms search
                term: "match",
                scope: SearchScope.All,
                promise: Promise.resolve({
                    results: [makeResult(room.roomId, "$here", 2), makeResult(otherRoom.roomId, "$there", 1)],
                    highlights: [],
                    count: 2,
                }),
            });

            // The stepper IS enabled for all-rooms searches now, with the full cross-room match list.
            await screen.findByText("0 of 2", { exact: false });
            expect(screen.getByRole("button", { name: "Next match" })).toBeInTheDocument();

            const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");
            await userEvent.click(screen.getByRole("button", { name: "Next match" })); // $here (this room)
            await screen.findByText("1 of 2", { exact: false });
            await userEvent.click(screen.getByRole("button", { name: "Next match" })); // $there (the other room)
            await screen.findByText("2 of 2", { exact: false });

            // Stepping reaches a match in a different room, dispatching ViewRoom for that room.
            expect(dispatchSpy).toHaveBeenCalledWith(
                expect.objectContaining({ action: Action.ViewRoom, room_id: otherRoom.roomId, event_id: "$there" }),
            );
        });
    });

    it("fires Action.RoomLoaded", async () => {
        jest.spyOn(defaultDispatcher, "dispatch");
        await mountRoomView();
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: Action.RoomLoaded });
    });

    // Regression test for https://github.com/element-hq/element-web/issues/29072
    it("does not force a reload on sync unless the client is coming back online", async () => {
        cli.isInitialSyncComplete.mockReturnValue(false);

        const instance = await getRoomViewInstance();
        const onRoomViewUpdateMock = jest.fn();
        (instance as any).onRoomViewStoreUpdate = onRoomViewUpdateMock;

        act(() => {
            // As if a connectivity check happened (we are still offline)
            defaultDispatcher.dispatch({ action: "MatrixActions.sync" }, true);
            // ...so it still should not force a reload
            expect(onRoomViewUpdateMock).not.toHaveBeenCalledWith(true);
        });

        act(() => {
            // set us to online again
            cli.isInitialSyncComplete.mockReturnValue(true);
            defaultDispatcher.dispatch({ action: "MatrixActions.sync" }, true);
        });

        // It should now force a reload
        expect(onRoomViewUpdateMock).toHaveBeenCalledWith(true);
    });

    describe("handles Action.ComposerInsert", () => {
        it("redispatches an empty composerType with the current state", async () => {
            await mountRoomView();
            const promise = untilDispatch((payload) => {
                try {
                    expect(payload).toEqual({
                        action: Action.ComposerInsert,
                        text: "Hello world",
                        timelineRenderingType: TimelineRenderingType.Room,
                        composerType: ComposerType.Send,
                    });
                } catch {
                    return false;
                }
                return true;
            }, defaultDispatcher);
            defaultDispatcher.dispatch({
                action: Action.ComposerInsert,
                text: "Hello world",
                timelineRenderingType: TimelineRenderingType.Room,
            } satisfies ComposerInsertPayload);
            await promise;
        });
        it("ignores payloads with a timelineRenderingType != TimelineRenderingType.Thread", async () => {
            await mountRoomView();
            const promise = untilDispatch(
                (payload) => {
                    try {
                        expect(payload).toStrictEqual({
                            action: Action.ComposerInsert,
                            text: "Hello world",
                            timelineRenderingType: TimelineRenderingType.Thread,
                            composerType: ComposerType.Send,
                        });
                    } catch {
                        return false;
                    }
                    return true;
                },
                defaultDispatcher,
                500,
            );
            defaultDispatcher.dispatch({
                action: Action.ComposerInsert,
                text: "Hello world",
                composerType: ComposerType.Send,
                timelineRenderingType: TimelineRenderingType.Room,
                viaTest: true,
            } satisfies ComposerInsertPayload);
            await expect(promise).rejects.toThrow();
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
            room.addLiveEvents([widgetEvent], { addToState: false });
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

    it("should not change room when editing event in a room displayed in module", async () => {
        const room2 = new Room("!room2:example.org", cli, "@alice:example.org");
        rooms.set(room2.roomId, room2);
        room.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);
        room2.getMyMembership = jest.fn().mockReturnValue(KnownMembership.Join);

        await mountRoomView();

        // Mock the spaceStore activeSpace and ModuleApi setup
        jest.spyOn(stores.spaceStore, "activeSpace", "get").mockReturnValue("space1");
        // Mock that room2 is displayed in a module
        ModuleApi.instance.extras.getVisibleRoomBySpaceKey("space1", () => [room2.roomId]);

        // Mock the roomViewStore method
        jest.spyOn(stores.roomViewStore, "isRoomDisplayedInModule").mockReturnValue(true);

        // Create an event in room2 to edit
        const eventInRoom2 = new MatrixEvent({
            type: "m.room.message",
            event_id: "$edit-event:example.org",
            room_id: room2.roomId,
            sender: "@alice:example.org",
            content: {
                body: "Original message",
                msgtype: "m.text",
            },
        });

        const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");

        // Dispatch EditEvent for event in room2 (which is displayed in module)
        defaultDispatcher.dispatch({
            action: Action.EditEvent,
            event: eventInRoom2,
            timelineRenderingType: TimelineRenderingType.Room,
        });

        await flushPromises();

        // Should not dispatch ViewRoom action since room2 is displayed in module
        expect(dispatchSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({
                action: Action.ViewRoom,
                room_id: room2.roomId,
            }),
        );
    });
});
