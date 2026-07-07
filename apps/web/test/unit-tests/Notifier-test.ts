/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { mocked, type MockedObject } from "jest-mock-vitest-adapter";
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
import { CallMembership, type SessionMembershipData, type MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc";
import { randomUUID } from "node:crypto";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

import type BasePlatform from "../../src/BasePlatform";
import Notifier, { NOTIFICATION_SOUND_THROTTLE_MS } from "../../src/Notifier";
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
import UserActivity from "../../src/UserActivity";
import Modal from "../../src/Modal";
import { mkThread } from "../test-utils/threads";
import dis from "../../src/dispatcher/dispatcher";
import { type ThreadPayload } from "../../src/dispatcher/payloads/ThreadPayload";
import { Action } from "../../src/dispatcher/actions";
import { addReplyToMessageContent } from "../../src/utils/Reply";
import { TestSDKContext } from "./TestSDKContext.ts";

jest.mock("../../src/utils/notifications", () => ({
    // @ts-ignore
    ...jest.requireActual("../../src/utils/notifications"),
    createLocalNotificationSettingsIfNeeded: jest.fn(),
}));

jest.mock("../../src/audio/compat", () => ({
    ...jest.requireActual("../../src/audio/compat"),
    createAudioContext: jest.fn(),
}));

const settingsStoreGetValue = SettingsStore.getValue;

describe("Notifier", () => {
    const context = new TestSDKContext();
    let notifier: Notifier;

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
            fetchRoomEvent: jest.fn(),
            decryptEventIfNeeded: jest.fn(),
            getRoom: jest.fn(),
            getPushActionsForEvent: jest.fn(),
            // Mock required because TextForEvent now evaluates supportsVoip for RTCNotification to trigger OS popups.
            // The true/false value is arbitrary here, as this test only verifies the in-app toast creation, not the OS text output.
            supportsVoip: jest.fn().mockReturnValue(true),
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
        // @ts-ignore
        mockClient.pushProcessor = new PushProcessor(mockClient);
        accountDataEventKey = getLocalNotificationAccountDataEventType(mockClient.deviceId!);

        testRoom = new Room(roomId, mockClient, mockClient.getSafeUserId());

        MockPlatform = mockPlatformPeg({
            supportsNotifications: jest.fn().mockReturnValue(true),
            maySendNotifications: jest.fn().mockReturnValue(true),
            displayNotification: jest.fn().mockReturnValue({ close: jest.fn() }),
            loudNotification: jest.fn(),
            requestNotificationPermission: jest.fn(),
        });

        notifier = new Notifier(dis, context);
        notifier.isBodyEnabled = jest.fn().mockReturnValue(true);

        mockClient.getRoom.mockImplementation((id: string | undefined): Room | null => {
            if (id === roomId) return testRoom;
            if (id) return new Room(id, mockClient, mockClient.getSafeUserId());
            return null;
        });

        // @ts-ignore
        notifier.backgroundAudio.audioContext = mockAudioContext;
        context._client = mockClient;
    });

    describe("triggering notification from events", () => {
        let hasStartedNotiferBefore = false;

        const event = new MatrixEvent({
            sender: "@alice:server.org",
            type: "m.room.message",
            room_id: roomId,
            content: {
                body: "hey",
            },
        });

        beforeEach(() => {
            // notifier defines some listener functions in start
            // and references them in stop
            // so blows up if stopped before it was started
            if (hasStartedNotiferBefore) {
                notifier.stop();
            }
            notifier.start();
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
            notifier.stop();
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

        it("closes a desktop notification when room is marked read", () => {
            mockClient!.emit(ClientEvent.Sync, SyncState.Syncing, null);
            emitLiveEvent(event);

            expect(MockPlatform.displayNotification).toHaveBeenCalledWith(testRoom.name, "hey", null, testRoom, event);
            mockClient!.emit(RoomEvent.Receipt, event, testRoom);
            expect(
                (
                    MockPlatform.displayNotification.mock.results[0].value as ReturnType<
                        typeof MockPlatform.displayNotification
                    >
                ).close,
            ).toHaveBeenCalled();
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
            notifier.displayPopupNotification(testEvent, testRoom);
            expect(MockPlatform.displayNotification).toHaveBeenCalledTimes(count);
        });

        it("should display a notification for a voice message", () => {
            const audioEvent = mkAudioEvent();
            notifier.displayPopupNotification(audioEvent, testRoom);
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
            notifier.displayPopupNotification(reply, testRoom);
            expect(MockPlatform.displayNotification).toHaveBeenCalledWith(
                "@bob:example.org (!room1:server)",
                "This was a triumph",
                expect.any(String),
                testRoom,
                reply,
            );
        });

        it.each([
            ["This was a triumph", "This was a triumph", "This was a triumph"],
            ["This was a triumph", "<span data-mx-spoiler>This was a triumph</span>", "[Spoiler]"],
            ["This was a triumph", '<span data-mx-spoiler="triumph">This was a triumph</span>', "[Spoiler]"],
            ["foo bar baz", "foo <span data-mx-spoiler>bar</span> baz", "foo [Spoiler] baz"],
            ["foo foo foo", "foo <span data-mx-spoiler>foo</span> foo", "foo [Spoiler] foo"],
            [
                "a b c d e",
                "a <span data-mx-spoiler>b</span> c <span data-mx-spoiler>d</span> e",
                "a [Spoiler] c [Spoiler] e",
            ],
            ["foo  foo", "foo <span data-mx-spoiler></span> foo", "foo [Spoiler] foo"],
            ["foo bar baz", "foo <span data-mx-spoiler>b<em>a</em>r</span> baz", "foo [Spoiler] baz"],
            ["foobar", "<span data-mx-spoiler>foo</span><span data-mx-spoiler>bar</span>", "[Spoiler][Spoiler]"],
            ["foo bar baz", "<strong>foo <span data-mx-spoiler>bar</span> baz</strong>", "foo [Spoiler] baz"],
            ["foo <bar> baz", "foo <span data-mx-spoiler>&lt;bar&gt;</span> baz", "foo [Spoiler] baz"],
            ["foo\nbar\nbaz", "foo<span data-mx-spoiler><br>bar<br></span>baz", "foo[Spoiler]baz"],
        ])("should hide spoilers in notification", (body, formattedBody, expected) => {
            const spoilerEvent = mkEvent({
                event: true,
                type: EventType.RoomMessage,
                user: mockClient.getSafeUserId(),
                room: testRoom.roomId,
                content: {
                    msgtype: MsgType.Text,
                    body: body,
                    format: "org.matrix.custom.html",
                    formatted_body: formattedBody,
                },
            });
            notifier.displayPopupNotification(spoilerEvent, testRoom);
            expect(MockPlatform.displayNotification).toHaveBeenCalledWith(
                "@bob:example.org (!room1:server)",
                expected,
                expect.any(String),
                testRoom,
                spoilerEvent,
            );
        });
    });

    describe("getSoundForRoom", () => {
        it("should not explode if given invalid url", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string): any => {
                return { url: { content_uri: "foobar" } };
            });
            expect(notifier.getSoundForRoom("!roomId:server")).toBeNull();
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
            notifier.getSoundForRoom = jest.fn();

            mockClient.setAccountData(accountDataEventKey, event!);
            notifier.playAudioNotification(testEvent, testRoom);
            expect(notifier.getSoundForRoom).toHaveBeenCalledTimes(count);
        });
    });

    // Regression test for https://github.com/element-hq/element-web/issues/31996
    // On macOS Sequoia, waking from sleep delivers the whole sync backlog in one
    // batch, firing playAudioNotification for every backlogged notifying event
    // near-simultaneously. Without throttling, the identical sound buffers
    // superimpose into one loud "stacked" sound. We coalesce a burst into at
    // most one audible play within NOTIFICATION_SOUND_THROTTLE_MS.
    describe("playAudioNotification throttle (macOS wake-from-sleep stacking)", () => {
        let playSpy: jest.SpyInstance;

        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(0);

            // Ensure notifications are not silenced so we exercise the throttle,
            // not the silencing gate.
            accountDataStore = {};
            mockClient.setAccountData(accountDataEventKey, { is_silenced: false });

            // Default sound path (no custom room sound).
            jest.spyOn(notifier, "getSoundForRoom").mockReturnValue(null);

            // @ts-ignore - backgroundAudio is private
            playSpy = jest.spyOn(notifier.backgroundAudio, "pickFormatAndPlay").mockResolvedValue({} as any);
        });

        afterEach(() => {
            playSpy.mockRestore();
            jest.useRealTimers();
        });

        it("plays at most one sound for a burst of notifications within the throttle window", async () => {
            // Simulate a backlog of notifications arriving back-to-back on wake.
            await notifier.playAudioNotification(testEvent, testRoom);
            await notifier.playAudioNotification(testEvent, testRoom);
            await notifier.playAudioNotification(testEvent, testRoom);

            expect(playSpy).toHaveBeenCalledTimes(1);
        });

        it("plays again once the throttle window has elapsed", async () => {
            await notifier.playAudioNotification(testEvent, testRoom);
            expect(playSpy).toHaveBeenCalledTimes(1);

            // Advance the clock just past the throttle window.
            jest.setSystemTime(NOTIFICATION_SOUND_THROTTLE_MS + 1);

            await notifier.playAudioNotification(testEvent, testRoom);
            expect(playSpy).toHaveBeenCalledTimes(2);
        });

        it("throttles right up to the window boundary, then plays again (strict `<`)", async () => {
            await notifier.playAudioNotification(testEvent, testRoom);
            expect(playSpy).toHaveBeenCalledTimes(1);

            // One ms before the window elapses: still throttled.
            jest.setSystemTime(NOTIFICATION_SOUND_THROTTLE_MS - 1);
            await notifier.playAudioNotification(testEvent, testRoom);
            expect(playSpy).toHaveBeenCalledTimes(1);

            // Exactly at the window boundary: plays again (the comparison is a strict `<`).
            jest.setSystemTime(NOTIFICATION_SOUND_THROTTLE_MS);
            await notifier.playAudioNotification(testEvent, testRoom);
            expect(playSpy).toHaveBeenCalledTimes(2);
        });

        it("does not coalesce two genuinely different sounds within the window (#31996 per-sound keying)", async () => {
            const soundA = { url: "sound-a.mp3", name: "A", type: "audio/mpeg", size: 1 };
            const soundB = { url: "sound-b.mp3", name: "B", type: "audio/mpeg", size: 1 };
            const otherRoom = new Room("!other:server", mockClient, mockClient.getSafeUserId());
            jest.mocked(notifier.getSoundForRoom).mockImplementation((roomId: string) =>
                roomId === testRoom.roomId ? soundA : soundB,
            );
            // @ts-ignore - backgroundAudio is private
            const customPlaySpy = jest.spyOn(notifier.backgroundAudio, "play").mockResolvedValue({} as any);

            // Two different sounds back-to-back within the window: BOTH must play (only identical
            // backlogged sounds are coalesced).
            await notifier.playAudioNotification(testEvent, testRoom);
            await notifier.playAudioNotification(testEvent, otherRoom);

            expect(customPlaySpy).toHaveBeenCalledTimes(2);
            expect(customPlaySpy).toHaveBeenNthCalledWith(1, soundA.url);
            expect(customPlaySpy).toHaveBeenNthCalledWith(2, soundB.url);
            customPlaySpy.mockRestore();
        });

        it("does not play, and does not arm the throttle, when notifications are silenced", async () => {
            mockClient.setAccountData(accountDataEventKey, { is_silenced: true });

            await notifier.playAudioNotification(testEvent, testRoom);
            await notifier.playAudioNotification(testEvent, testRoom);

            // Silencing gate short-circuits before the sound is played.
            expect(playSpy).not.toHaveBeenCalled();

            // ...and the silenced calls did NOT arm the throttle: once un-silenced, the next event plays
            // immediately (a regression arming the throttle on silenced events would suppress this).
            mockClient.setAccountData(accountDataEventKey, { is_silenced: false });
            await notifier.playAudioNotification(testEvent, testRoom);
            expect(playSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("group call notifications", () => {
        let callId: string;
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((key, ...params) => {
                if (key === "notificationsEnabled") {
                    return true;
                }
                return settingsStoreGetValue(key, ...params);
            });
            jest.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");
            jest.spyOn(ToastStore.sharedInstance(), "dismissToast");
            ToastStore.sharedInstance().reset();

            mockClient.getPushActionsForEvent.mockReturnValue({
                notify: true,
                tweaks: {},
            });
            callId = randomUUID();
            jest.spyOn(testRoom, "findEventById").mockImplementation((eventId) => {
                if (eventId === "$memberEventId") {
                    return mkEvent({
                        event: true,
                        user: "@alice:foo",
                        type: "org.matrix.msc4143.rtc.member",
                        content: { call_id: callId } satisfies Partial<SessionMembershipData>,
                    });
                }
                return undefined;
            });
            notifier.start();
            notifier.onSyncStateChange(SyncState.Syncing, null);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        const emitCallNotificationEvent = (
            params: {
                type?: string;
                roomMention?: boolean;
                lifetime?: number;
                ts?: number;
                content?: Partial<IContent>;
            } = {},
        ) => {
            const { type, roomMention, lifetime, ts, content } = {
                type: EventType.RTCNotification,
                roomMention: true,
                lifetime: 30000,
                ts: Date.now(),
                ...params,
            };
            const notificationEvent = mkEvent({
                type: type,
                user: "@alice:foo",
                room: roomId,
                ts,
                content: {
                    "notification_type": "ring",
                    "m.relates_to": { rel_type: "m.reference", event_id: "$memberEventId" },
                    "m.mentions": { user_ids: [], room: roomMention },
                    lifetime,
                    "sender_ts": ts,
                    ...content,
                },
                event: true,
            });
            emitLiveEvent(notificationEvent);
            return notificationEvent;
        };

        it("shows group call toast", () => {
            const notificationEvent = emitCallNotificationEvent();

            expect(ToastStore.sharedInstance().addOrReplaceToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: getIncomingCallToastKey(callId, roomId),
                    priority: 100,
                    component: IncomingCallToast,
                    bodyClassName: "mx_IncomingCallToast",
                    props: { notificationEvent },
                }),
            );
        });

        it("shows group call toast once for multiple notifications to the same call", () => {
            // Call the same function twice.
            emitCallNotificationEvent();
            emitCallNotificationEvent();
            expect(ToastStore.sharedInstance().addOrReplaceToast).toHaveBeenCalledTimes(1);
        });

        it("shows group call toast even if the call membership is not stored locally", () => {
            jest.spyOn(testRoom, "findEventById").mockReturnValue(undefined);
            jest.spyOn(mockClient, "fetchRoomEvent").mockImplementation(async (roomId, eventId) => {
                if (eventId === "$memberEventId" && roomId === testRoom.roomId) {
                    return {
                        user: "@alice:foo",
                        type: "org.matrix.msc4143.rtc.member",
                        content: { call_id: callId } satisfies Partial<SessionMembershipData>,
                    };
                }
                throw new Error("Test mockClient.fetchRoomEvent failed to find event");
            });

            const notificationEvent = emitCallNotificationEvent();
            waitFor(() => {
                expect(ToastStore.sharedInstance().addOrReplaceToast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        key: getIncomingCallToastKey(callId, roomId),
                        priority: 100,
                        component: IncomingCallToast,
                        bodyClassName: "mx_IncomingCallToast",
                        props: { notificationEvent },
                    }),
                );
            });
        });

        it.each<IContent>([
            { "m.relates_to": undefined },
            { "m.relates_to": { rel_type: "m.reference" } },
            { "m.relates_to": { event_id: "$memberEventId", rel_type: "something.else" } },
        ])("ignores invalid relations for call notification", (content) => {
            emitCallNotificationEvent({ content });
            waitFor(() => {
                expect(ToastStore.sharedInstance().addOrReplaceToast).not.toHaveBeenCalled();
            });
        });

        it("ignores a call if the membership is missing", () => {
            jest.spyOn(testRoom, "findEventById").mockReturnValue(undefined);
            jest.spyOn(mockClient, "fetchRoomEvent").mockImplementation(async () => {
                throw new Error("Test mockClient.fetchRoomEvent expected not to find event");
            });

            emitCallNotificationEvent();
            waitFor(() => {
                expect(ToastStore.sharedInstance().addOrReplaceToast).not.toHaveBeenCalled();
            });
        });

        it("should not show toast when group call is already connected", () => {
            const members = [
                new CallMembership(
                    mkEvent({
                        event: true,
                        room: testRoom.roomId,
                        user: userId,
                        type: EventType.GroupCallMemberPrefix,
                        content: {},
                    }),
                    {
                        // TODO: Once https://github.com/matrix-org/matrix-js-sdk/pull/5134 is merged this can be MembershipKind.Session
                        kind: "session" as any,
                        data: {
                            call_id: "123",
                            application: "m.call",
                            focus_active: { type: "livekit", focus_selection: "oldest_membership" },
                            foci_preferred: [],
                            device_id: "DEVICE",
                        },
                    },
                    "hashed_id_XXXAAAAA",
                ),
            ];

            const mockRtcSession = {
                memberships: members,
                slotDescription: { application: "m.call", id: "" },
            } as unknown as MatrixRTCSession;

            mocked(mockClient.matrixRTC.getRoomSession).mockReturnValue(mockRtcSession);

            emitCallNotificationEvent();
            expect(ToastStore.sharedInstance().addOrReplaceToast).not.toHaveBeenCalled();
        });

        it("should not show toast when calling with a different event type to org.matrix.msc4075.rtc.notification", () => {
            emitCallNotificationEvent({ type: "event_type" });

            expect(ToastStore.sharedInstance().addOrReplaceToast).not.toHaveBeenCalled();
        });

        it("should not show notification event is expired", () => {
            emitCallNotificationEvent({ ts: Date.now() - 40000 });

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
                notifier.stop();
            }
            notifier.start();
            hasStartedNotiferBefore = true;
            createLocalNotificationSettingsIfNeededMock.mockClear();
        });

        afterAll(() => {
            notifier.stop();
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
            jest.spyOn(context.roomViewStore, "getRoomId").mockReturnValue(testRoom.roomId);

            jest.spyOn(UserActivity.sharedInstance(), "userActiveRecently").mockReturnValue(true);

            jest.spyOn(Modal, "hasDialogs").mockReturnValue(false);

            jest.spyOn(notifier, "displayPopupNotification").mockReset();
            jest.spyOn(notifier, "isEnabled").mockReturnValue(true);

            mockClient.getPushActionsForEvent.mockReturnValue({
                notify: true,
                tweaks: {
                    sound: true,
                },
            });
        });

        it("should show a pop-up", () => {
            expect(notifier.displayPopupNotification).toHaveBeenCalledTimes(0);
            notifier.evaluateEvent(testEvent);
            expect(notifier.displayPopupNotification).toHaveBeenCalledTimes(0);

            const eventFromOtherRoom = mkEvent({
                event: true,
                type: "m.room.message",
                user: "@user1:server",
                room: "!otherroom:example.org",
                content: {},
            });

            notifier.evaluateEvent(eventFromOtherRoom);
            expect(notifier.displayPopupNotification).toHaveBeenCalledTimes(1);
        });

        it("should a pop-up for thread event", async () => {
            const { events, rootEvent } = mkThread({
                room: testRoom,
                client: mockClient,
                authorId: "@bob:example.org",
                participantUserIds: ["@bob:example.org"],
            });

            expect(notifier.displayPopupNotification).toHaveBeenCalledTimes(0);

            notifier.evaluateEvent(rootEvent);
            expect(notifier.displayPopupNotification).toHaveBeenCalledTimes(0);

            notifier.evaluateEvent(events[1]);
            expect(notifier.displayPopupNotification).toHaveBeenCalledTimes(1);

            dis.dispatch<ThreadPayload>({
                action: Action.ViewThread,
                thread_id: rootEvent.getId()!,
            });

            await waitFor(() => expect(context.roomViewStore.getThreadId()).toBe(rootEvent.getId()));

            notifier.evaluateEvent(events[1]);
            expect(notifier.displayPopupNotification).toHaveBeenCalledTimes(1);
        });

        it("should show a pop-up for an audio message", () => {
            notifier.evaluateEvent(mkAudioEvent());
            expect(notifier.displayPopupNotification).toHaveBeenCalledTimes(1);
        });
    });

    describe("setPromptHidden", () => {
        it("should persist by default", () => {
            notifier.setPromptHidden(true);
            expect(localStorage.getItem("notifications_hidden")).toBeTruthy();
        });
    });

    describe("onEvent", () => {
        it("should not evaluate events from the thread list fake timeline sets", async () => {
            mockClient.supportsThreads.mockReturnValue(true);

            const fn = jest.spyOn(notifier, "evaluateEvent");

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

    describe("setEnabled", () => {
        it("should call fire notifier_enabled value=true when permission is granted", async () => {
            const dispatchSpy = jest.spyOn(dis, "dispatch");
            const notifier = new Notifier(dis, context);

            jest.mocked(MockPlatform.requestNotificationPermission).mockResolvedValue("granted");

            const resolvers = Promise.withResolvers<void>();
            notifier.setEnabled(true, resolvers.resolve);
            await resolvers.promise;

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "notifier_enabled",
                value: true,
            });
        });

        it("should call fire notifier_enabled value=false when disabling", async () => {
            const dispatchSpy = jest.spyOn(dis, "dispatch");
            const notifier = new Notifier(dis, context);

            notifier.setEnabled(false);

            expect(dispatchSpy).toHaveBeenCalledWith({
                action: "notifier_enabled",
                value: false,
            });
        });
    });
});
