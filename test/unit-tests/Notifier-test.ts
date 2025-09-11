/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { mocked, type MockedObject } from "jest-mock";
import {
    ClientEvent,
    type MatrixClient,
    Room,
    RoomEvent,
    EventType,
    MsgType,
    type IContent,
    MatrixEvent,
    SyncState,
    type AccountDataEvents,
} from "matrix-js-sdk/src/matrix";
import { waitFor } from "jest-matrix-react";
import { CallMembership, MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";

import type BasePlatform from "../../src/BasePlatform";
import Notifier from "../../src/Notifier";
import SettingsStore from "../../src/settings/SettingsStore";
import ToastStore from "../../src/stores/ToastStore";
import {
    createLocalNotificationSettingsIfNeeded,
    getLocalNotificationAccountDataEventType,
} from "../../src/utils/notifications";
import {
    getMockClientWithEventEmitter,
    mkEvent,
    mkMessage,
    mockClientMethodsUser,
    mockPlatformPeg,
} from "../test-utils";
import { getIncomingCallToastKey, IncomingCallToast } from "../../src/toasts/IncomingCallToast";
import { SdkContextClass } from "../../src/contexts/SDKContext";
import UserActivity from "../../src/UserActivity";
import Modal from "../../src/Modal";
import { mkThread } from "../test-utils/threads";
import dis from "../../src/dispatcher/dispatcher";
import { type ThreadPayload } from "../../src/dispatcher/payloads/ThreadPayload";
import { Action } from "../../src/dispatcher/actions";
import { addReplyToMessageContent } from "../../src/utils/Reply";

jest.mock("../../src/utils/notifications", () => ({
    // @ts-ignore
    ...jest.requireActual("../../src/utils/notifications"),
    createLocalNotificationSettingsIfNeeded: jest.fn(),
}));

jest.mock("../../src/audio/compat", () => ({
    ...jest.requireActual("../../src/audio/compat"),
    createAudioContext: jest.fn(),
}));

describe("Notifier", () => {
    const roomId = "!room1:server";
    const testEvent = mkEvent({
        event: true,
        type: "m.room.message",
        user: "@user1:server",
        room: roomId,
        content: {},
    });

    let MockPlatform: MockedObject<BasePlatform>;
    let mockClient: MockedObject<MatrixClient>;
    let testRoom: Room;
    let accountDataEventKey: keyof AccountDataEvents;
    let accountDataStore: Record<string, MatrixEvent | undefined> = {};

    let mockSettings: Record<string, boolean> = {};

    const userId = "@bob:example.org";

    const emitLiveEvent = (event: MatrixEvent): void => {
        mockClient!.emit(RoomEvent.Timeline, event, testRoom, false, false, {
            liveEvent: true,
            timeline: testRoom.getLiveTimeline(),
        });
    };

    const mkAudioEvent = (): MatrixEvent => {
        return mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@user:example.com",
            room: "!room:example.com",
            content: {
                msgtype: MsgType.Audio,
                body: "test audio message",
            },
        });
    };

    const mockAudioBufferSourceNode = {
        addEventListener: jest.fn(),
        connect: jest.fn(),
        start: jest.fn(),
    };
    const mockAudioContext = {
        decodeAudioData: jest.fn(),
        suspend: jest.fn(),
        resume: jest.fn(),
        createBufferSource: jest.fn().mockReturnValue(mockAudioBufferSourceNode),
        currentTime: 1337,
    };

    beforeEach(() => {
        accountDataStore = {};
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
            isGuest: jest.fn().mockReturnValue(false),
            getAccountData: jest.fn().mockImplementation((eventType) => accountDataStore[eventType]),
            setAccountData: jest.fn().mockImplementation((eventType, content) => {
                accountDataStore[eventType] = content
                    ? new MatrixEvent({
                          type: eventType,
                          content,
                      })
                    : undefined;
            }),
            decryptEventIfNeeded: jest.fn(),
            getRoom: jest.fn(),
            getPushActionsForEvent: jest.fn(),
            supportsThreads: jest.fn().mockReturnValue(false),
            matrixRTC: {
                on: jest.fn(),
                off: jest.fn(),
                getRoomSession: jest.fn(),
            },
        });

        mockClient.pushRules = {
            global: {},
        };
        accountDataEventKey = getLocalNotificationAccountDataEventType(mockClient.deviceId!);

        testRoom = new Room(roomId, mockClient, mockClient.getSafeUserId());

        MockPlatform = mockPlatformPeg({
            supportsNotifications: jest.fn().mockReturnValue(true),
            maySendNotifications: jest.fn().mockReturnValue(true),
            displayNotification: jest.fn(),
            loudNotification: jest.fn(),
        });

        Notifier.isBodyEnabled = jest.fn().mockReturnValue(true);

        mockClient.getRoom.mockImplementation((id: string | undefined): Room | null => {
            if (id === roomId) return testRoom;
            if (id) return new Room(id, mockClient, mockClient.getSafeUserId());
            return null;
        });

        // @ts-ignore
        Notifier.backgroundAudio.audioContext = mockAudioContext;
    });

    describe("triggering notification from events", () => {
        let hasStartedNotiferBefore = false;

        const event = new MatrixEvent({
            sender: "@alice:server.org",
            type: "m.room.message",
            room_id: "!room:server.org",
            content: {
                body: "hey",
            },
        });

        beforeEach(() => {
            // notifier defines some listener functions in start
            // and references them in stop
            // so blows up if stopped before it was started
            if (hasStartedNotiferBefore) {
                Notifier.stop();
            }
            Notifier.start();
            hasStartedNotiferBefore = true;
            mockClient.getRoom.mockReturnValue(testRoom);
            mockClient.getPushActionsForEvent.mockReturnValue({
                notify: true,
                tweaks: {
                    sound: true,
                },
            });

            mockSettings = {
                notificationsEnabled: true,
                audioNotificationsEnabled: true,
            };

            // enable notifications by default
            jest.spyOn(SettingsStore, "getValue")
                .mockReset()
                .mockImplementation((settingName) => mockSettings[settingName] ?? false);
        });

        afterAll(() => {
            Notifier.stop();
        });

        it("does not create notifications before syncing has started", () => {
            emitLiveEvent(event);

            expect(MockPlatform.displayNotification).not.toHaveBeenCalled();
            expect(MockPlatform.loudNotification).not.toHaveBeenCalled();
        });

        it("does not create notifications for own event", () => {
            const ownEvent = new MatrixEvent({ sender: userId });

            mockClient!.emit(ClientEvent.Sync, SyncState.Syncing, null);
            emitLiveEvent(ownEvent);

            expect(MockPlatform.displayNotification).not.toHaveBeenCalled();
            expect(MockPlatform.loudNotification).not.toHaveBeenCalled();
        });

        it("does not create notifications for non-live events (scrollback)", () => {
            mockClient!.emit(ClientEvent.Sync, SyncState.Syncing, null);
            mockClient!.emit(RoomEvent.Timeline, event, testRoom, false, false, {
                liveEvent: false,
                timeline: testRoom.getLiveTimeline(),
            });

            expect(MockPlatform.displayNotification).not.toHaveBeenCalled();
            expect(MockPlatform.loudNotification).not.toHaveBeenCalled();
        });

        it("does not create notifications for rooms which cannot be obtained via client.getRoom", () => {
            mockClient!.emit(ClientEvent.Sync, SyncState.Syncing, null);
            mockClient.getRoom.mockReturnValue(null);
            mockClient!.emit(RoomEvent.Timeline, event, testRoom, false, false, {
                liveEvent: true,
                timeline: testRoom.getLiveTimeline(),
            });

            expect(MockPlatform.displayNotification).not.toHaveBeenCalled();
            expect(MockPlatform.loudNotification).not.toHaveBeenCalled();
        });

        it("does not create notifications when event does not have notify push action", () => {
            mockClient.getPushActionsForEvent.mockReturnValue({
                notify: false,
                tweaks: {
                    sound: true,
                },
            });

            mockClient!.emit(ClientEvent.Sync, SyncState.Syncing, null);
            emitLiveEvent(event);

            expect(MockPlatform.displayNotification).not.toHaveBeenCalled();
            expect(MockPlatform.loudNotification).not.toHaveBeenCalled();
        });

        it("creates desktop notification when enabled", () => {
            mockClient!.emit(ClientEvent.Sync, SyncState.Syncing, null);
            emitLiveEvent(event);

            expect(MockPlatform.displayNotification).toHaveBeenCalledWith(testRoom.name, "hey", null, testRoom, event);
        });

        it("creates a loud notification when enabled", () => {
            mockClient!.emit(ClientEvent.Sync, SyncState.Syncing, null);
            emitLiveEvent(event);

            expect(MockPlatform.loudNotification).toHaveBeenCalledWith(event, testRoom);
        });

        it("does not create loud notification when event does not have sound tweak in push actions", () => {
            mockClient.getPushActionsForEvent.mockReturnValue({
                notify: true,
                tweaks: {
                    sound: false,
                },
            });

            mockClient!.emit(ClientEvent.Sync, SyncState.Syncing, null);
            emitLiveEvent(event);

            // desktop notification created
            expect(MockPlatform.displayNotification).toHaveBeenCalled();
            // without noisy
            expect(MockPlatform.loudNotification).not.toHaveBeenCalled();
        });
    });

    describe("displayPopupNotification", () => {
        const testCases: { event: IContent | undefined; count: number }[] = [
            { event: { is_silenced: true }, count: 0 },
            { event: { is_silenced: false }, count: 1 },
            { event: undefined, count: 1 },
        ];
        it.each(testCases)("does not dispatch when notifications are silenced", ({ event, count }) => {
            mockClient.setAccountData(accountDataEventKey, event!);
            Notifier.displayPopupNotification(testEvent, testRoom);
            expect(MockPlatform.displayNotification).toHaveBeenCalledTimes(count);
        });

        it("should display a notification for a voice message", () => {
            const audioEvent = mkAudioEvent();
            Notifier.displayPopupNotification(audioEvent, testRoom);
            expect(MockPlatform.displayNotification).toHaveBeenCalledWith(
                "@user:example.com (!room1:server)",
                "@user:example.com: test audio message",
                "data:image/png;base64,00",
                testRoom,
                audioEvent,
            );
        });

        it("should strip reply fallback", () => {
            const event = mkMessage({
                msg: "Test",
                event: true,
                user: mockClient.getSafeUserId(),
                room: testRoom.roomId,
            });
            const reply = mkMessage({
                msg: "This was a triumph",
                event: true,
                user: mockClient.getSafeUserId(),
                room: testRoom.roomId,
            });
            addReplyToMessageContent(reply.getContent(), event);
            Notifier.displayPopupNotification(reply, testRoom);
            expect(MockPlatform.displayNotification).toHaveBeenCalledWith(
                "@bob:example.org (!room1:server)",
                "This was a triumph",
                expect.any(String),
                testRoom,
                reply,
            );
        });
    });

    describe("getSoundForRoom", () => {
        it("should not explode if given invalid url", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string): any => {
                return { url: { content_uri: "foobar" } };
            });
            expect(Notifier.getSoundForRoom("!roomId:server")).toBeNull();
        });
    });

    describe("_playAudioNotification", () => {
        const testCases: { event: IContent | undefined; count: number }[] = [
            { event: { is_silenced: true }, count: 0 },
            { event: { is_silenced: false }, count: 1 },
            { event: undefined, count: 1 },
        ];
        it.each(testCases)("does not dispatch when notifications are silenced", ({ event, count }) => {
            // It's not ideal to only look at whether this function has been called
            // but avoids starting to look into DOM stuff
            Notifier.getSoundForRoom = jest.fn();

            mockClient.setAccountData(accountDataEventKey, event!);
            Notifier.playAudioNotification(testEvent, testRoom);
            expect(Notifier.getSoundForRoom).toHaveBeenCalledTimes(count);
        });
    });

    describe("group call notifications", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
            jest.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");

            mockClient.getPushActionsForEvent.mockReturnValue({
                notify: true,
                tweaks: {},
            });
            Notifier.start();
            Notifier.onSyncStateChange(SyncState.Syncing, null);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        const emitCallNotifyEvent = (type?: string, roomMention = true) => {
            const callEvent = mkEvent({
                type: type ?? EventType.CallNotify,
                user: "@alice:foo",
                room: roomId,
                content: {
                    "application": "m.call",
                    "m.mentions": { user_ids: [], room: roomMention },
                    "notify_type": "ring",
                    "call_id": "abc123",
                },
                event: true,
            });
            emitLiveEvent(callEvent);
            return callEvent;
        };

        it("shows group call toast", () => {
            const notifyEvent = emitCallNotifyEvent();

            expect(ToastStore.sharedInstance().addOrReplaceToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: getIncomingCallToastKey(notifyEvent.getContent().call_id ?? "", roomId),
                    priority: 100,
                    component: IncomingCallToast,
                    bodyClassName: "mx_IncomingCallToast",
                    props: { notifyEvent },
                }),
            );
        });

        it("should not show toast when group call is already connected", () => {
            const spyCallMemberships = jest.spyOn(MatrixRTCSession, "callMembershipsForRoom").mockReturnValue([
                new CallMembership(
                    mkEvent({
                        event: true,
                        room: testRoom.roomId,
                        user: userId,
                        type: EventType.GroupCallMemberPrefix,
                        content: {},
                    }),
                    {
                        call_id: "123",
                        application: "m.call",
                        focus_active: { type: "livekit" },
                        foci_preferred: [],
                        device_id: "DEVICE",
                    },
                ),
            ]);

            const roomSession = MatrixRTCSession.roomSessionForRoom(mockClient, testRoom);

            mockClient.matrixRTC.getRoomSession.mockReturnValue(roomSession);
            emitCallNotifyEvent();
            expect(ToastStore.sharedInstance().addOrReplaceToast).not.toHaveBeenCalled();
            spyCallMemberships.mockRestore();
        });

        it("should not show toast when calling with non-group call event", () => {
            emitCallNotifyEvent("event_type");

            expect(ToastStore.sharedInstance().addOrReplaceToast).not.toHaveBeenCalled();
        });
    });

    describe("local notification settings", () => {
        const createLocalNotificationSettingsIfNeededMock = mocked(createLocalNotificationSettingsIfNeeded);
        let hasStartedNotiferBefore = false;
        beforeEach(() => {
            // notifier defines some listener functions in start
            // and references them in stop
            // so blows up if stopped before it was started
            if (hasStartedNotiferBefore) {
                Notifier.stop();
            }
            Notifier.start();
            hasStartedNotiferBefore = true;
            createLocalNotificationSettingsIfNeededMock.mockClear();
        });

        afterAll(() => {
            Notifier.stop();
        });

        it("does not create local notifications event after a sync error", () => {
            mockClient.emit(ClientEvent.Sync, SyncState.Error, SyncState.Syncing);
            expect(createLocalNotificationSettingsIfNeededMock).not.toHaveBeenCalled();
        });

        it("does not create local notifications event after sync stops", () => {
            mockClient.emit(ClientEvent.Sync, SyncState.Stopped, SyncState.Syncing);
            expect(createLocalNotificationSettingsIfNeededMock).not.toHaveBeenCalled();
        });

        it("does not create local notifications event after a cached sync", () => {
            mockClient.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing, {
                fromCache: true,
            });
            expect(createLocalNotificationSettingsIfNeededMock).not.toHaveBeenCalled();
        });

        it("creates local notifications event after a non-cached sync", () => {
            mockClient.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing, {});
            expect(createLocalNotificationSettingsIfNeededMock).toHaveBeenCalled();
        });
    });

    describe("evaluateEvent", () => {
        beforeEach(() => {
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(testRoom.roomId);

            jest.spyOn(UserActivity.sharedInstance(), "userActiveRecently").mockReturnValue(true);

            jest.spyOn(Modal, "hasDialogs").mockReturnValue(false);

            jest.spyOn(Notifier, "displayPopupNotification").mockReset();
            jest.spyOn(Notifier, "isEnabled").mockReturnValue(true);

            mockClient.getPushActionsForEvent.mockReturnValue({
                notify: true,
                tweaks: {
                    sound: true,
                },
            });
        });

        it("should show a pop-up", () => {
            expect(Notifier.displayPopupNotification).toHaveBeenCalledTimes(0);
            Notifier.evaluateEvent(testEvent);
            expect(Notifier.displayPopupNotification).toHaveBeenCalledTimes(0);

            const eventFromOtherRoom = mkEvent({
                event: true,
                type: "m.room.message",
                user: "@user1:server",
                room: "!otherroom:example.org",
                content: {},
            });

            Notifier.evaluateEvent(eventFromOtherRoom);
            expect(Notifier.displayPopupNotification).toHaveBeenCalledTimes(1);
        });

        it("should a pop-up for thread event", async () => {
            const { events, rootEvent } = mkThread({
                room: testRoom,
                client: mockClient,
                authorId: "@bob:example.org",
                participantUserIds: ["@bob:example.org"],
            });

            expect(Notifier.displayPopupNotification).toHaveBeenCalledTimes(0);

            Notifier.evaluateEvent(rootEvent);
            expect(Notifier.displayPopupNotification).toHaveBeenCalledTimes(0);

            Notifier.evaluateEvent(events[1]);
            expect(Notifier.displayPopupNotification).toHaveBeenCalledTimes(1);

            dis.dispatch<ThreadPayload>({
                action: Action.ViewThread,
                thread_id: rootEvent.getId()!,
            });

            await waitFor(() => expect(SdkContextClass.instance.roomViewStore.getThreadId()).toBe(rootEvent.getId()));

            Notifier.evaluateEvent(events[1]);
            expect(Notifier.displayPopupNotification).toHaveBeenCalledTimes(1);
        });

        it("should show a pop-up for an audio message", () => {
            Notifier.evaluateEvent(mkAudioEvent());
            expect(Notifier.displayPopupNotification).toHaveBeenCalledTimes(1);
        });
    });

    describe("setPromptHidden", () => {
        it("should persist by default", () => {
            Notifier.setPromptHidden(true);
            expect(localStorage.getItem("notifications_hidden")).toBeTruthy();
        });
    });

    describe("onEvent", () => {
        it("should not evaluate events from the thread list fake timeline sets", async () => {
            mockClient.supportsThreads.mockReturnValue(true);

            const fn = jest.spyOn(Notifier, "evaluateEvent");

            await testRoom.createThreadsTimelineSets();
            testRoom.threadsTimelineSets[0]!.addEventToTimeline(
                mkEvent({
                    event: true,
                    type: "m.room.message",
                    user: "@user1:server",
                    room: roomId,
                    content: { body: "this is a thread root" },
                }),
                testRoom.threadsTimelineSets[0]!.getLiveTimeline(),
                { toStartOfTimeline: false, fromCache: false, addToState: true },
            );

            expect(fn).not.toHaveBeenCalled();
        });
    });
});
