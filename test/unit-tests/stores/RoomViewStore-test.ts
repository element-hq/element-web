/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { MatrixError, Room } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import {
    RoomViewLifecycle,
    type ViewRoomOpts,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";
import EventEmitter from "events";

import { RoomViewStore } from "../../../src/stores/RoomViewStore";
import { Action } from "../../../src/dispatcher/actions";
import {
    getMockClientWithEventEmitter,
    setupAsyncStoreWithClient,
    untilDispatch,
    untilEmission,
} from "../../test-utils";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SlidingSyncManager } from "../../../src/SlidingSyncManager";
import { PosthogAnalytics } from "../../../src/PosthogAnalytics";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import { UPDATE_EVENT } from "../../../src/stores/AsyncStore";
import { type ActiveRoomChangedPayload } from "../../../src/dispatcher/payloads/ActiveRoomChangedPayload";
import { SpaceStoreClass } from "../../../src/stores/spaces/SpaceStore";
import { TestSdkContext } from "../TestSdkContext";
import { type ViewRoomPayload } from "../../../src/dispatcher/payloads/ViewRoomPayload";
import Modal from "../../../src/Modal";
import ErrorDialog from "../../../src/components/views/dialogs/ErrorDialog";
import { type CancelAskToJoinPayload } from "../../../src/dispatcher/payloads/CancelAskToJoinPayload";
import { type JoinRoomErrorPayload } from "../../../src/dispatcher/payloads/JoinRoomErrorPayload";
import { type SubmitAskToJoinPayload } from "../../../src/dispatcher/payloads/SubmitAskToJoinPayload";
import { ModuleRunner } from "../../../src/modules/ModuleRunner";
import { type IApp } from "../../../src/utils/WidgetUtils-types";
import { CallStore } from "../../../src/stores/CallStore";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import MediaDeviceHandler, { MediaDeviceKindEnum } from "../../../src/MediaDeviceHandler";

jest.mock("../../../src/Modal");

// mock out the injected classes
jest.mock("../../../src/PosthogAnalytics");
const MockPosthogAnalytics = <jest.Mock<PosthogAnalytics>>(<unknown>PosthogAnalytics);
jest.mock("../../../src/SlidingSyncManager");
const MockSlidingSyncManager = <jest.Mock<SlidingSyncManager>>(<unknown>SlidingSyncManager);
jest.mock("../../../src/stores/spaces/SpaceStore");
const MockSpaceStore = <jest.Mock<SpaceStoreClass>>(<unknown>SpaceStoreClass);

// mock VoiceRecording because it contains all the audio APIs
jest.mock("../../../src/audio/VoiceRecording", () => ({
    VoiceRecording: jest.fn().mockReturnValue({
        disableMaxLength: jest.fn(),
        liveData: {
            onUpdate: jest.fn(),
        },
        off: jest.fn(),
        on: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
        contentType: "audio/ogg",
    }),
}));

jest.spyOn(MediaDeviceHandler, "getDevices").mockResolvedValue({
    [MediaDeviceKindEnum.AudioInput]: [],
    [MediaDeviceKindEnum.VideoInput]: [],
    [MediaDeviceKindEnum.AudioOutput]: [],
});

jest.mock("../../../src/utils/DMRoomMap", () => {
    const mock = {
        getUserIdForRoomId: jest.fn(),
        getDMRoomsForUserId: jest.fn(),
    };

    return {
        shared: jest.fn().mockReturnValue(mock),
        sharedInstance: mock,
    };
});

jest.mock("../../../src/stores/WidgetStore", () => {
    // This mock needs to use a real EventEmitter; require is the only way to import that in a hoisted block
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const EventEmitter = require("events");
    const apps: IApp[] = [];
    const instance = new (class extends EventEmitter {
        getApps() {
            return apps;
        }
        addVirtualWidget(app: IApp) {
            apps.push(app);
        }
    })();
    return { instance };
});
jest.mock("../../../src/stores/widgets/WidgetLayoutStore");

describe("RoomViewStore", function () {
    const userId = "@alice:server";
    const roomId = "!randomcharacters:aser.ver";
    const roomId2 = "!room2:example.com";
    // we need to change the alias to ensure cache misses as the cache exists
    // through all tests.
    let alias = "#somealias2:aser.ver";
    const getRooms = jest.fn();
    const mockClient = getMockClientWithEventEmitter({
        joinRoom: jest.fn(),
        getRoom: jest.fn(),
        getRoomIdForAlias: jest.fn(),
        getRooms,
        isGuest: jest.fn(),
        getUserId: jest.fn().mockReturnValue(userId),
        getSafeUserId: jest.fn().mockReturnValue(userId),
        getDeviceId: jest.fn().mockReturnValue("ABC123"),
        sendStateEvent: jest.fn().mockResolvedValue({}),
        supportsThreads: jest.fn(),
        isInitialSyncComplete: jest.fn().mockResolvedValue(false),
        relations: jest.fn(),
        knockRoom: jest.fn(),
        leave: jest.fn(),
        setRoomAccountData: jest.fn(),
        getAccountData: jest.fn(),
        matrixRTC: new (class extends EventEmitter {
            getRoomSession() {
                return new (class extends EventEmitter {
                    memberships = [];
                })();
            }
        })(),
    });
    const room = new Room(roomId, mockClient, userId);
    const room2 = new Room(roomId2, mockClient, userId);
    getRooms.mockReturnValue([room, room2]);

    const viewCall = async (): Promise<void> => {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            view_call: true,
            metricsTrigger: undefined,
        });
        await untilDispatch(Action.ViewRoom, dis);
    };

    const dispatchPromptAskToJoin = async () => {
        dis.dispatch({ action: Action.PromptAskToJoin });
        await untilDispatch(Action.PromptAskToJoin, dis);
    };

    const dispatchSubmitAskToJoin = async (roomId: string, reason?: string) => {
        dis.dispatch<SubmitAskToJoinPayload>({ action: Action.SubmitAskToJoin, roomId, opts: { reason } });
        await untilDispatch(Action.SubmitAskToJoin, dis);
    };

    const dispatchCancelAskToJoin = async (roomId: string) => {
        dis.dispatch<CancelAskToJoinPayload>({ action: Action.CancelAskToJoin, roomId });
        await untilDispatch(Action.CancelAskToJoin, dis);
    };

    const dispatchRoomLoaded = async () => {
        dis.dispatch({ action: Action.RoomLoaded });
        await untilDispatch(Action.RoomLoaded, dis);
    };

    let roomViewStore: RoomViewStore;
    let slidingSyncManager: SlidingSyncManager;
    let dis: MatrixDispatcher;
    let stores: TestSdkContext;

    beforeEach(function () {
        jest.clearAllMocks();
        mockClient.credentials = { userId: userId };
        mockClient.joinRoom.mockResolvedValue(room);
        mockClient.getRoom.mockImplementation((roomId: string): Room | null => {
            if (roomId === room.roomId) return room;
            if (roomId === room2.roomId) return room2;
            return null;
        });
        mockClient.isGuest.mockReturnValue(false);
        mockClient.getSafeUserId.mockReturnValue(userId);

        // Make the RVS to test
        dis = new MatrixDispatcher();
        slidingSyncManager = new MockSlidingSyncManager();
        stores = new TestSdkContext();
        stores.client = mockClient;
        stores._SlidingSyncManager = slidingSyncManager;
        stores._PosthogAnalytics = new MockPosthogAnalytics();
        // @ts-expect-error
        MockPosthogAnalytics.instance = stores._PosthogAnalytics;
        stores._SpaceStore = new MockSpaceStore();
        roomViewStore = new RoomViewStore(dis, stores);
        stores._RoomViewStore = roomViewStore;
    });

    it("can be used to view a room by ID and join", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        dis.dispatch({ action: Action.JoinRoom });
        await untilDispatch(Action.JoinRoomReady, dis);
        expect(mockClient.joinRoom).toHaveBeenCalledWith(roomId, { viaServers: [] });
        expect(roomViewStore.isJoining()).toBe(true);
    });

    it("can auto-join a room", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId, auto_join: true });
        await untilDispatch(Action.JoinRoomReady, dis);
        expect(mockClient.joinRoom).toHaveBeenCalledWith(roomId, { viaServers: [] });
        expect(roomViewStore.isJoining()).toBe(true);
    });

    it("emits ActiveRoomChanged when the viewed room changes", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        let payload = (await untilDispatch(Action.ActiveRoomChanged, dis)) as ActiveRoomChangedPayload;
        expect(payload.newRoomId).toEqual(roomId);
        expect(payload.oldRoomId).toEqual(null);

        dis.dispatch({ action: Action.ViewRoom, room_id: roomId2 });
        payload = (await untilDispatch(Action.ActiveRoomChanged, dis)) as ActiveRoomChangedPayload;
        expect(payload.newRoomId).toEqual(roomId2);
        expect(payload.oldRoomId).toEqual(roomId);
    });

    it("invokes room activity listeners when the viewed room changes", async () => {
        const callback = jest.fn();
        roomViewStore.addRoomListener(roomId, callback);
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        (await untilDispatch(Action.ActiveRoomChanged, dis)) as ActiveRoomChangedPayload;
        expect(callback).toHaveBeenCalledWith(true);
        expect(callback).not.toHaveBeenCalledWith(false);

        dis.dispatch({ action: Action.ViewRoom, room_id: roomId2 });
        (await untilDispatch(Action.ActiveRoomChanged, dis)) as ActiveRoomChangedPayload;
        expect(callback).toHaveBeenCalledWith(false);
    });

    it("can be used to view a room by alias and join", async () => {
        mockClient.getRoomIdForAlias.mockResolvedValue({ room_id: roomId, servers: [] });
        dis.dispatch({ action: Action.ViewRoom, room_alias: alias });
        await untilDispatch((p) => {
            // wait for the re-dispatch with the room ID
            return p.action === Action.ViewRoom && p.room_id === roomId;
        }, dis);

        // roomId is set to id of the room alias
        expect(roomViewStore.getRoomId()).toBe(roomId);

        // join the room
        dis.dispatch({ action: Action.JoinRoom }, true);

        await untilDispatch(Action.JoinRoomReady, dis);

        expect(roomViewStore.isJoining()).toBeTruthy();
        expect(mockClient.joinRoom).toHaveBeenCalledWith(alias, { viaServers: [] });
    });

    it("emits ViewRoomError if the alias lookup fails", async () => {
        alias = "#something-different:to-ensure-cache-miss";
        mockClient.getRoomIdForAlias.mockRejectedValue(new Error("network error or something"));
        dis.dispatch({ action: Action.ViewRoom, room_alias: alias });
        const payload = await untilDispatch(Action.ViewRoomError, dis);
        expect(payload.room_id).toBeNull();
        expect(payload.room_alias).toEqual(alias);
        expect(roomViewStore.getRoomAlias()).toEqual(alias);
    });

    it("emits JoinRoomError if joining the room fails", async () => {
        const joinErr = new Error("network error or something");
        mockClient.joinRoom.mockRejectedValue(joinErr);
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        dis.dispatch({ action: Action.JoinRoom });
        await untilDispatch(Action.JoinRoomError, dis);
        expect(roomViewStore.isJoining()).toBe(false);
        expect(roomViewStore.getJoinError()).toEqual(joinErr);
    });

    it("remembers the event being replied to when swapping rooms", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        await untilDispatch(Action.ActiveRoomChanged, dis);
        const replyToEvent = {
            getRoomId: () => roomId,
        };
        dis.dispatch({ action: "reply_to_event", event: replyToEvent, context: TimelineRenderingType.Room });
        await untilEmission(roomViewStore, UPDATE_EVENT);
        expect(roomViewStore.getQuotingEvent()).toEqual(replyToEvent);
        // view the same room, should remember the event.
        // set the highlighed flag to make sure there is a state change so we get an update event
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId, highlighted: true });
        await untilEmission(roomViewStore, UPDATE_EVENT);
        expect(roomViewStore.getQuotingEvent()).toEqual(replyToEvent);
    });

    it("swaps to the replied event room if it is not the current room", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        await untilDispatch(Action.ActiveRoomChanged, dis);
        const replyToEvent = {
            getRoomId: () => roomId2,
        };
        dis.dispatch({ action: "reply_to_event", event: replyToEvent, context: TimelineRenderingType.Room });
        await untilDispatch(Action.ViewRoom, dis);
        expect(roomViewStore.getQuotingEvent()).toEqual(replyToEvent);
        expect(roomViewStore.getRoomId()).toEqual(roomId2);
    });

    it("should ignore reply_to_event for Thread panels", async () => {
        expect(roomViewStore.getQuotingEvent()).toBeFalsy();
        const replyToEvent = {
            getRoomId: () => roomId2,
        };
        dis.dispatch({ action: "reply_to_event", event: replyToEvent, context: TimelineRenderingType.Thread });
        await sleep(100);
        expect(roomViewStore.getQuotingEvent()).toBeFalsy();
    });

    it.each([TimelineRenderingType.Room, TimelineRenderingType.File, TimelineRenderingType.Notification])(
        "Should respect reply_to_event for %s rendering context",
        async (context) => {
            const replyToEvent = {
                getRoomId: () => roomId,
            };
            dis.dispatch({ action: "reply_to_event", event: replyToEvent, context });
            await untilDispatch(Action.ViewRoom, dis);
            expect(roomViewStore.getQuotingEvent()).toEqual(replyToEvent);
        },
    );

    it("removes the roomId on ViewHomePage", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        await untilDispatch(Action.ActiveRoomChanged, dis);
        expect(roomViewStore.getRoomId()).toEqual(roomId);

        dis.dispatch({ action: Action.ViewHomePage });
        await untilEmission(roomViewStore, UPDATE_EVENT);
        expect(roomViewStore.getRoomId()).toBeNull();
    });

    it("when viewing a call without a broadcast, it should not raise an error", async () => {
        await setupAsyncStoreWithClient(CallStore.instance, MatrixClientPeg.safeGet());
        await viewCall();
    });

    it("should display an error message when the room is unreachable via the roomId", async () => {
        // When
        // View and wait for the room
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        await untilDispatch(Action.ActiveRoomChanged, dis);
        // Generate error to display the expected error message
        const error = new MatrixError(undefined, 404);
        roomViewStore.showJoinRoomError(error, roomId);

        // Check the modal props
        expect(mocked(Modal).createDialog.mock.calls[0][1]).toMatchSnapshot();
    });

    it("should display the generic error message when the roomId doesnt match", async () => {
        // When
        // Generate error to display the expected error message
        const error = new MatrixError({ error: "my 404 error" }, 404);
        roomViewStore.showJoinRoomError(error, roomId);

        // Check the modal props
        expect(mocked(Modal).createDialog.mock.calls[0][1]).toMatchSnapshot();
    });

    it("clears the unread flag when viewing a room", async () => {
        room.getAccountData = jest.fn().mockReturnValue({
            getContent: jest.fn().mockReturnValue({ unread: true }),
        });
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        await untilDispatch(Action.ActiveRoomChanged, dis);
        expect(mockClient.setRoomAccountData).toHaveBeenCalledWith(roomId, "m.marked_unread", {
            unread: false,
        });
    });

    describe("Sliding Sync", function () {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName, roomId, value) => {
                return settingName === "feature_simplified_sliding_sync"; // this is enabled, everything else is disabled.
            });
        });

        it("subscribes to the room", async () => {
            const setRoomVisible = jest.spyOn(slidingSyncManager, "setRoomVisible").mockReturnValue(Promise.resolve());
            const subscribedRoomId = "!sub1:localhost";
            dis.dispatch({ action: Action.ViewRoom, room_id: subscribedRoomId });
            await untilDispatch(Action.ActiveRoomChanged, dis);
            expect(roomViewStore.getRoomId()).toBe(subscribedRoomId);
            expect(setRoomVisible).toHaveBeenCalledWith(subscribedRoomId);
        });

        // Previously a regression test for an in-the-wild bug where rooms would rapidly switch forever in sliding sync mode
        // although that was before the complexity was removed with similified mode. I've removed the complexity but kept the
        // test anyway.
        it("doesn't get stuck in a loop if you view rooms quickly", async () => {
            const setRoomVisible = jest.spyOn(slidingSyncManager, "setRoomVisible").mockReturnValue(Promise.resolve());
            const subscribedRoomId = "!sub1:localhost";
            const subscribedRoomId2 = "!sub2:localhost";
            dis.dispatch({ action: Action.ViewRoom, room_id: subscribedRoomId }, true);
            dis.dispatch({ action: Action.ViewRoom, room_id: subscribedRoomId2 }, true);
            await untilDispatch(Action.ActiveRoomChanged, dis);
            // should view 1, then 2
            const wantCalls = [[subscribedRoomId], [subscribedRoomId2]];
            expect(setRoomVisible).toHaveBeenCalledTimes(wantCalls.length);
            wantCalls.forEach((v, i) => {
                try {
                    expect(setRoomVisible.mock.calls[i][0]).toEqual(v[0]);
                } catch {
                    throw new Error(`i=${i} got ${setRoomVisible.mock.calls[i]} want ${v}`);
                }
            });
        });
    });

    describe("Action.JoinRoom", () => {
        it("dispatches Action.JoinRoomError and Action.AskToJoin when the join fails", async () => {
            const err = new MatrixError();

            jest.spyOn(dis, "dispatch");
            jest.spyOn(mockClient, "joinRoom").mockRejectedValueOnce(err);

            dis.dispatch({ action: Action.JoinRoom, canAskToJoin: true });
            await untilDispatch(Action.PromptAskToJoin, dis);

            expect(mocked(dis.dispatch).mock.calls[0][0]).toEqual({ action: "join_room", canAskToJoin: true });
            expect(mocked(dis.dispatch).mock.calls[1][0]).toEqual({
                action: "join_room_error",
                roomId: null,
                err,
                canAskToJoin: true,
            });
            expect(mocked(dis.dispatch).mock.calls[2][0]).toEqual({ action: "prompt_ask_to_join" });
        });
    });

    describe("Action.JoinRoomError", () => {
        const err = new MatrixError();
        beforeEach(() => jest.spyOn(roomViewStore, "showJoinRoomError"));

        it("calls showJoinRoomError()", async () => {
            dis.dispatch<JoinRoomErrorPayload>({ action: Action.JoinRoomError, roomId, err });
            await untilDispatch(Action.JoinRoomError, dis);
            expect(roomViewStore.showJoinRoomError).toHaveBeenCalledWith(err, roomId);
        });

        it("does not call showJoinRoomError() when canAskToJoin is true", async () => {
            dis.dispatch<JoinRoomErrorPayload>({ action: Action.JoinRoomError, roomId, err, canAskToJoin: true });
            await untilDispatch(Action.JoinRoomError, dis);
            expect(roomViewStore.showJoinRoomError).not.toHaveBeenCalled();
        });
    });

    describe("askToJoin()", () => {
        it("returns false", () => {
            expect(roomViewStore.promptAskToJoin()).toBe(false);
        });

        it("returns true", async () => {
            await dispatchPromptAskToJoin();
            expect(roomViewStore.promptAskToJoin()).toBe(true);
        });
    });

    describe("Action.SubmitAskToJoin", () => {
        const reason = "some reason";
        beforeEach(async () => await dispatchPromptAskToJoin());

        it("calls knockRoom() and sets promptAskToJoin state to false", async () => {
            jest.spyOn(mockClient, "knockRoom").mockResolvedValue({ room_id: roomId });
            await dispatchSubmitAskToJoin(roomId, reason);

            expect(mockClient.knockRoom).toHaveBeenCalledWith(roomId, { reason, viaServers: [] });
            expect(roomViewStore.promptAskToJoin()).toBe(false);
        });

        it("calls knockRoom(), sets promptAskToJoin state to false and shows an error dialog", async () => {
            const error = new MatrixError(undefined, 403);
            jest.spyOn(mockClient, "knockRoom").mockRejectedValue(error);
            await dispatchSubmitAskToJoin(roomId, reason);

            expect(mockClient.knockRoom).toHaveBeenCalledWith(roomId, { reason, viaServers: [] });
            expect(roomViewStore.promptAskToJoin()).toBe(false);
            expect(Modal.createDialog).toHaveBeenCalledWith(ErrorDialog, {
                description: "You need an invite to access this room.",
                title: "Failed to join",
            });
        });

        it("shows an error dialog with a generic error message", async () => {
            const error = new MatrixError();
            jest.spyOn(mockClient, "knockRoom").mockRejectedValue(error);
            await dispatchSubmitAskToJoin(roomId);

            expect(Modal.createDialog).toHaveBeenCalledWith(ErrorDialog, {
                description: error.message,
                title: "Failed to join",
            });
        });
    });

    describe("Action.CancelAskToJoin", () => {
        beforeEach(async () => {
            jest.spyOn(mockClient, "knockRoom").mockResolvedValue({ room_id: roomId });
            await dispatchSubmitAskToJoin(roomId);
        });

        it("calls leave()", async () => {
            jest.spyOn(mockClient, "leave").mockResolvedValue({});
            await dispatchCancelAskToJoin(roomId);

            expect(mockClient.leave).toHaveBeenCalledWith(roomId);
        });

        it("calls leave() and shows an error dialog", async () => {
            const error = new MatrixError();
            jest.spyOn(mockClient, "leave").mockRejectedValue(error);
            await dispatchCancelAskToJoin(roomId);

            expect(mockClient.leave).toHaveBeenCalledWith(roomId);
            expect(Modal.createDialog).toHaveBeenCalledWith(ErrorDialog, {
                description: error.message,
                title: "Failed to cancel",
            });
        });
    });

    describe("getViewRoomOpts", () => {
        it("returns viewRoomOpts", () => {
            expect(roomViewStore.getViewRoomOpts()).toEqual({ buttons: [] });
        });
    });

    describe("Action.RoomLoaded", () => {
        it("updates viewRoomOpts", async () => {
            const buttons: ViewRoomOpts["buttons"] = [
                {
                    icon: "test-icon",
                    id: "test-id",
                    label: () => "test-label",
                    onClick: () => {},
                },
            ];
            jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts) => {
                if (lifecycleEvent === RoomViewLifecycle.ViewRoom) {
                    opts.buttons = buttons;
                }
            });
            await dispatchRoomLoaded();
            expect(roomViewStore.getViewRoomOpts()).toEqual({ buttons });
        });
    });
});
