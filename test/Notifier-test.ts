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

import { mocked, MockedObject } from "jest-mock";
import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/client";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { IContent, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { SyncState } from "matrix-js-sdk/src/sync";
import { waitFor } from "@testing-library/react";
import { EventType, MsgType } from "matrix-js-sdk/src/matrix";

import BasePlatform from "../src/BasePlatform";
import { ElementCall } from "../src/models/Call";
import Notifier from "../src/Notifier";
import SettingsStore from "../src/settings/SettingsStore";
import ToastStore from "../src/stores/ToastStore";
import {
    createLocalNotificationSettingsIfNeeded,
    getLocalNotificationAccountDataEventType,
} from "../src/utils/notifications";
import { getMockClientWithEventEmitter, mkEvent, mockClientMethodsUser, mockPlatformPeg } from "./test-utils";
import { IncomingCallToast } from "../src/toasts/IncomingCallToast";
import { SdkContextClass } from "../src/contexts/SDKContext";
import UserActivity from "../src/UserActivity";
import Modal from "../src/Modal";
import { mkThread } from "./test-utils/threads";
import dis from "../src/dispatcher/dispatcher";
import { ThreadPayload } from "../src/dispatcher/payloads/ThreadPayload";
import { Action } from "../src/dispatcher/actions";
import { VoiceBroadcastChunkEventType, VoiceBroadcastInfoState } from "../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "./voice-broadcast/utils/test-utils";

jest.mock("../src/utils/notifications", () => ({
    // @ts-ignore
    ...jest.requireActual("../src/utils/notifications"),
    createLocalNotificationSettingsIfNeeded: jest.fn(),
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
    let accountDataEventKey: string;
    let accountDataStore: Record<string, MatrixEvent | undefined> = {};

    let mockSettings: Record<string, boolean> = {};

    const userId = "@bob:example.org";

    const emitLiveEvent = (event: MatrixEvent): void => {
        mockClient!.emit(RoomEvent.Timeline, event, testRoom, false, false, {
            liveEvent: true,
            timeline: testRoom.getLiveTimeline(),
        });
    };

    const mkAudioEvent = (broadcastChunkContent?: object): MatrixEvent => {
        const chunkContent = broadcastChunkContent ? { [VoiceBroadcastChunkEventType]: broadcastChunkContent } : {};

        return mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: "@user:example.com",
            room: "!room:example.com",
            content: {
                ...chunkContent,
                msgtype: MsgType.Audio,
                body: "test audio message",
            },
        });
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

        it("should display the expected notification for a broadcast chunk with sequence = 1", () => {
            const audioEvent = mkAudioEvent({ sequence: 1 });
            Notifier.displayPopupNotification(audioEvent, testRoom);
            expect(MockPlatform.displayNotification).toHaveBeenCalledWith(
                "@user:example.com (!room1:server)",
                "@user:example.com started a voice broadcast",
                "data:image/png;base64,00",
                testRoom,
                audioEvent,
            );
        });

        it("should display the expected notification for a broadcast chunk with sequence = 2", () => {
            const audioEvent = mkAudioEvent({ sequence: 2 });
            Notifier.displayPopupNotification(audioEvent, testRoom);
            expect(MockPlatform.displayNotification).not.toHaveBeenCalled();
        });
    });

    describe("getSoundForRoom", () => {
        it("should not explode if given invalid url", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
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

        const callOnEvent = (type?: string) => {
            const callEvent = mkEvent({
                type: type ?? ElementCall.CALL_EVENT_TYPE.name,
                user: "@alice:foo",
                room: roomId,
                content: {},
                event: true,
            });
            emitLiveEvent(callEvent);
            return callEvent;
        };

        const setGroupCallsEnabled = (val: boolean) => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
                if (name === "feature_group_calls") return val;
            });
        };

        it("should show toast when group calls are supported", () => {
            setGroupCallsEnabled(true);

            const callEvent = callOnEvent();

            expect(ToastStore.sharedInstance().addOrReplaceToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: `call_${callEvent.getStateKey()}`,
                    priority: 100,
                    component: IncomingCallToast,
                    bodyClassName: "mx_IncomingCallToast",
                    props: { callEvent },
                }),
            );
        });

        it("should not show toast when group calls are not supported", () => {
            setGroupCallsEnabled(false);

            callOnEvent();

            expect(ToastStore.sharedInstance().addOrReplaceToast).not.toHaveBeenCalled();
        });

        it("should not show toast when calling with non-group call event", () => {
            setGroupCallsEnabled(true);

            callOnEvent("event_type");

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

        it("should not show a notification for broadcast info events in any case", () => {
            // Let client decide to show a notification
            mockClient.getPushActionsForEvent.mockReturnValue({
                notify: true,
                tweaks: {},
            });

            const broadcastStartedEvent = mkVoiceBroadcastInfoStateEvent(
                "!other:example.org",
                VoiceBroadcastInfoState.Started,
                "@user:example.com",
                "ABC123",
            );

            Notifier.evaluateEvent(broadcastStartedEvent);
            expect(Notifier.displayPopupNotification).not.toHaveBeenCalled();
        });
    });

    describe("setPromptHidden", () => {
        it("should persist by default", () => {
            Notifier.setPromptHidden(true);
            expect(localStorage.getItem("notifications_hidden")).toBeTruthy();
        });
    });
});
