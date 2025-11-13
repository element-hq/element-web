/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen, waitFor } from "jest-matrix-react";
import {
    type MatrixClient,
    PendingEventOrdering,
    EventStatus,
    type MatrixEvent,
    Room,
    MatrixError,
} from "matrix-js-sdk/src/matrix";

import RoomStatusBar, { getUnsentMessages } from "../../../../src/components/structures/RoomStatusBar";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { mkEvent, stubClient, upsertRoomStateEvents } from "../../../test-utils/test-utils";
import { mkThread } from "../../../test-utils/threads";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { type Settings } from "../../../../src/settings/Settings";

describe("RoomStatusBar", () => {
    const ROOM_ID = "!roomId:example.org";
    let room: Room;
    let client: MatrixClient;
    let event: MatrixEvent;

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.safeGet();
        client.getSyncStateData = jest.fn().mockReturnValue({});
        client.setRoomAccountData = jest.fn().mockResolvedValue({});
        room = new Room(ROOM_ID, client, client.getUserId()!, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        event = mkEvent({
            event: true,
            type: "m.room.message",
            user: "@user1:server",
            room: "!room1:server",
            content: {},
        });
        event.status = EventStatus.NOT_SENT;
    });

    const getComponent = () =>
        render(<RoomStatusBar room={room} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
            ),
        });

    describe("getUnsentMessages", () => {
        it("returns no unsent messages", () => {
            expect(getUnsentMessages(room)).toHaveLength(0);
        });

        it("checks the event status", () => {
            room.addPendingEvent(event, "123");

            expect(getUnsentMessages(room)).toHaveLength(1);
            event.status = EventStatus.SENT;

            expect(getUnsentMessages(room)).toHaveLength(0);
        });

        it("only returns events related to a thread", () => {
            room.addPendingEvent(event, "123");

            const { rootEvent, events } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@alice:example.org"],
                length: 2,
            });
            rootEvent.status = EventStatus.NOT_SENT;
            room.addPendingEvent(rootEvent, rootEvent.getId()!);
            for (const event of events) {
                event.status = EventStatus.NOT_SENT;
                room.addPendingEvent(event, Date.now() + Math.random() + "");
            }

            const pendingEvents = getUnsentMessages(room, rootEvent.getId());

            expect(pendingEvents[0].threadRootId).toBe(rootEvent.getId());
            expect(pendingEvents[1].threadRootId).toBe(rootEvent.getId());
            expect(pendingEvents[2].threadRootId).toBe(rootEvent.getId());

            // Filters out the non thread events
            expect(pendingEvents.every((ev) => ev.getId() !== event.getId())).toBe(true);
        });
    });

    describe("<RoomStatusBar />", () => {
        it("should render nothing when room has no error or unsent messages", () => {
            const { container } = getComponent();
            expect(container.firstChild).toBe(null);
        });

        describe("unsent messages", () => {
            it("should render warning when messages are unsent due to consent", () => {
                const unsentMessage = mkEvent({
                    event: true,
                    type: "m.room.message",
                    user: "@user1:server",
                    room: "!room1:server",
                    content: {},
                });
                unsentMessage.status = EventStatus.NOT_SENT;
                unsentMessage.error = new MatrixError({
                    errcode: "M_CONSENT_NOT_GIVEN",
                    data: { consent_uri: "terms.com" },
                });

                room.addPendingEvent(unsentMessage, "123");

                const { container } = getComponent();

                expect(container).toMatchSnapshot();
            });

            it("should render warning when messages are unsent due to resource limit", () => {
                const unsentMessage = mkEvent({
                    event: true,
                    type: "m.room.message",
                    user: "@user1:server",
                    room: "!room1:server",
                    content: {},
                });
                unsentMessage.status = EventStatus.NOT_SENT;
                unsentMessage.error = new MatrixError({
                    errcode: "M_RESOURCE_LIMIT_EXCEEDED",
                    data: { limit_type: "monthly_active_user" },
                });

                room.addPendingEvent(unsentMessage, "123");

                const { container } = getComponent();

                expect(container).toMatchSnapshot();
            });
        });
    });

    describe("Shared History Visibility Acknowledgement", () => {
        let acknowledgedHistoryVisibility = false;

        beforeAll(async () => {
            jest.spyOn(SettingsStore, "setValue").mockImplementation(
                async (settingName: keyof Settings, roomId: string | null = null, level: SettingLevel, value: any) => {
                    if (settingName == "acknowledgedHistoryVisibility") {
                        acknowledgedHistoryVisibility = value;
                    }
                },
            );
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName: keyof Settings, roomId: string | null = null, excludeDefault = false) => {
                    if (settingName == "acknowledgedHistoryVisibility") {
                        return acknowledgedHistoryVisibility;
                    }
                    if (settingName == "feature_share_history_on_invite") {
                        return true;
                    }
                    return SettingsStore.getDefaultValue(settingName, roomId);
                },
            );
        });

        beforeEach(async () => {
            await SettingsStore.setValue("acknowledgedHistoryVisibility", ROOM_ID, SettingLevel.ROOM_ACCOUNT, false);
        });

        it("should not render history visibility acknowledgement in unencrypted rooms", () => {
            const { container } = getComponent();
            expect(container).toMatchSnapshot();
        });

        it("should not render history visibility acknowledgement in encrypted rooms with joined history visibility", () => {
            upsertRoomStateEvents(room, [
                mkEvent({
                    event: true,
                    type: "m.room.encryption",
                    user: "@user1:server",
                    content: {},
                }),
                mkEvent({
                    event: true,
                    type: "m.room.history_visibility",
                    content: {
                        history_visibility: "joined",
                    },
                    user: "@user1:server",
                }),
            ]);

            const { container } = getComponent();
            expect(container).toMatchSnapshot();
        });

        it("should not render history visibility acknowledgement if it has previously been dismissed", async () => {
            await SettingsStore.setValue("acknowledgedHistoryVisibility", ROOM_ID, SettingLevel.ROOM_ACCOUNT, true);
            upsertRoomStateEvents(room, [
                mkEvent({
                    event: true,
                    type: "m.room.encryption",
                    user: "@user1:server",
                    content: {},
                }),
                mkEvent({
                    event: true,
                    type: "m.room.history_visibility",
                    user: "@user1:server",
                    content: {
                        history_visibility: "shared",
                    },
                }),
            ]);

            const { container } = getComponent();
            expect(container).toMatchSnapshot();
        });

        it("should render dismissable history visibility acknowledgement in encrypted rooms with non-join history visibility", async () => {
            upsertRoomStateEvents(room, [
                mkEvent({
                    event: true,
                    type: "m.room.encryption",
                    user: "@user1:server",
                    content: {},
                }),
                mkEvent({
                    event: true,
                    type: "m.room.history_visibility",
                    user: "@user1:server",
                    content: {
                        history_visibility: "shared",
                    },
                }),
            ]);

            const { container } = getComponent();
            expect(container).toMatchSnapshot();

            // assert dismiss button exists, and press it
            const dismissButton = screen.getByRole<HTMLButtonElement>("button", { name: "Dismiss" });
            expect(dismissButton).not.toBeNull();
            fireEvent.click(dismissButton!);

            await waitFor(() => expect(container).toBeEmptyDOMElement());
        });
    });
});
