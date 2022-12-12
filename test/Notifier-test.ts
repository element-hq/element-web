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
            supportsExperimentalThreads: jest.fn().mockReturnValue(false),
        });

        mockClient.pushRules = {
            global: undefined,
        };
        accountDataEventKey = getLocalNotificationAccountDataEventType(mockClient.deviceId);

        testRoom = new Room(roomId, mockClient, mockClient.getUserId());

        MockPlatform = mockPlatformPeg({
            supportsNotifications: jest.fn().mockReturnValue(true),
            maySendNotifications: jest.fn().mockReturnValue(true),
            displayNotification: jest.fn(),
            loudNotification: jest.fn(),
        });

        Notifier.isBodyEnabled = jest.fn().mockReturnValue(true);

        mockClient.getRoom.mockImplementation((id) => {
            return id === roomId ? testRoom : new Room(id, mockClient, mockClient.getUserId());
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

    describe("_displayPopupNotification", () => {
        const testCases: { event: IContent | undefined; count: number }[] = [
            { event: { is_silenced: true }, count: 0 },
            { event: { is_silenced: false }, count: 1 },
            { event: undefined, count: 1 },
        ];
        it.each(testCases)("does not dispatch when notifications are silenced", ({ event, count }) => {
            mockClient.setAccountData(accountDataEventKey, event!);
            Notifier._displayPopupNotification(testEvent, testRoom);
            expect(MockPlatform.displayNotification).toHaveBeenCalledTimes(count);
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
            Notifier._playAudioNotification(testEvent, testRoom);
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
            Notifier.onSyncStateChange(SyncState.Syncing);
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

    describe("_evaluateEvent", () => {
        beforeEach(() => {
            jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(testRoom.roomId);

            jest.spyOn(UserActivity.sharedInstance(), "userActiveRecently").mockReturnValue(true);

            jest.spyOn(Modal, "hasDialogs").mockReturnValue(false);

            jest.spyOn(Notifier, "_displayPopupNotification").mockReset();
            jest.spyOn(Notifier, "isEnabled").mockReturnValue(true);

            mockClient.getPushActionsForEvent.mockReturnValue({
                notify: true,
                tweaks: {
                    sound: true,
                },
            });
        });

        it("should show a pop-up", () => {
            expect(Notifier._displayPopupNotification).toHaveBeenCalledTimes(0);
            Notifier._evaluateEvent(testEvent);
            expect(Notifier._displayPopupNotification).toHaveBeenCalledTimes(0);

            const eventFromOtherRoom = mkEvent({
                event: true,
                type: "m.room.message",
                user: "@user1:server",
                room: "!otherroom:example.org",
                content: {},
            });

            Notifier._evaluateEvent(eventFromOtherRoom);
            expect(Notifier._displayPopupNotification).toHaveBeenCalledTimes(1);
        });

        it("should a pop-up for thread event", async () => {
            const { events, rootEvent } = mkThread({
                room: testRoom,
                client: mockClient,
                authorId: "@bob:example.org",
                participantUserIds: ["@bob:example.org"],
            });

            expect(Notifier._displayPopupNotification).toHaveBeenCalledTimes(0);

            Notifier._evaluateEvent(rootEvent);
            expect(Notifier._displayPopupNotification).toHaveBeenCalledTimes(0);

            Notifier._evaluateEvent(events[1]);
            expect(Notifier._displayPopupNotification).toHaveBeenCalledTimes(1);

            dis.dispatch<ThreadPayload>({
                action: Action.ViewThread,
                thread_id: rootEvent.getId(),
            });

            await waitFor(() => expect(SdkContextClass.instance.roomViewStore.getThreadId()).toBe(rootEvent.getId()));

            Notifier._evaluateEvent(events[1]);
            expect(Notifier._displayPopupNotification).toHaveBeenCalledTimes(1);
        });
    });

    describe("setPromptHidden", () => {
        it("should persist by default", () => {
            Notifier.setPromptHidden(true);
            expect(localStorage.getItem("notifications_hidden")).toBeTruthy();
        });
    });
});
