/*
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react";
import { renderHook } from "@testing-library/react-hooks";
import {
    MatrixClient,
    MatrixEventEvent,
    NotificationCountType,
    PendingEventOrdering,
    Room,
} from "matrix-js-sdk/src/matrix";
import { act } from "@testing-library/react";

import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { stubClient } from "../../../test-utils";
import { populateThread } from "../../../test-utils/threads";
import { NotificationLevel } from "../../../../src/stores/notifications/NotificationLevel";
import { useUnreadThreadRooms } from "../../../../src/components/views/spaces/threads-activity-centre/useUnreadThreadRooms";
import SettingsStore from "../../../../src/settings/SettingsStore";

describe("useUnreadThreadRooms", () => {
    let client: MatrixClient;
    let room: Room;

    beforeEach(() => {
        client = stubClient();
        client.supportsThreads = () => true;
        room = new Room("!room1:example.org", client, "@fee:bar", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("has no notifications with no rooms", async () => {
        const { result } = renderHook(() => useUnreadThreadRooms(false));
        const { greatestNotificationLevel, rooms } = result.current;

        expect(greatestNotificationLevel).toBe(NotificationLevel.None);
        expect(rooms.length).toEqual(0);
    });

    it("an activity notification is ignored by default", async () => {
        const notifThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 0);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { greatestNotificationLevel, rooms } = result.current;

        expect(greatestNotificationLevel).toBe(NotificationLevel.None);
        expect(rooms.length).toEqual(0);
    });

    it("an activity notification is displayed with the setting enabled", async () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);

        const notifThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 0);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { greatestNotificationLevel, rooms } = result.current;

        expect(greatestNotificationLevel).toBe(NotificationLevel.Activity);
        expect(rooms.length).toEqual(1);
    });

    it("a notification and a highlight summarise to a highlight", async () => {
        const notifThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 1);

        const highlightThreadInfo = await populateThread({
            room: room,
            client: client,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        room.setThreadUnreadNotificationCount(highlightThreadInfo.thread.id, NotificationCountType.Highlight, 1);

        client.getVisibleRooms = jest.fn().mockReturnValue([room]);

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
        );

        const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });
        const { greatestNotificationLevel, rooms } = result.current;

        expect(greatestNotificationLevel).toBe(NotificationLevel.Highlight);
        expect(rooms.length).toEqual(1);
    });

    describe("updates", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("updates on decryption within 1s", async () => {
            const notifThreadInfo = await populateThread({
                room: room,
                client: client,
                authorId: "@foo:bar",
                participantUserIds: ["@fee:bar"],
            });
            room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 0);

            client.getVisibleRooms = jest.fn().mockReturnValue([room]);

            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
            );

            const { result } = renderHook(() => useUnreadThreadRooms(true), { wrapper });

            expect(result.current.greatestNotificationLevel).toBe(NotificationLevel.None);

            act(() => {
                room.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Highlight, 1);
                client.emit(MatrixEventEvent.Decrypted, notifThreadInfo.thread.events[0]);

                jest.advanceTimersByTime(1000);
            });

            expect(result.current.greatestNotificationLevel).toBe(NotificationLevel.Highlight);
        });
    });
});
