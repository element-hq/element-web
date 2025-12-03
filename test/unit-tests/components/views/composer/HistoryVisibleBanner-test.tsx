/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { fireEvent, render, screen, waitFor } from "jest-matrix-react";
import { Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import React from "react";

import { HistoryVisibleBanner } from "../../../../../src/components/views/composer/HistoryVisibleBanner";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import { type Settings } from "../../../../../src/settings/Settings";
import SettingsStore, { type CallbackFn } from "../../../../../src/settings/SettingsStore";
import { mkEvent, stubClient, upsertRoomStateEvents } from "../../../../test-utils";

describe("<HistoryVisibleBanner />", () => {
    const watcherCallbacks: CallbackFn[] = [];
    let acknowledgedHistoryVisibility = false;

    beforeAll(async () => {
        jest.spyOn(SettingsStore, "setValue").mockImplementation(
            async (settingName: keyof Settings, roomId: string | null = null, level: SettingLevel, value: any) => {
                if (settingName == "acknowledgedHistoryVisibility") {
                    acknowledgedHistoryVisibility = value;
                    watcherCallbacks.forEach((callbackFn) => {
                        callbackFn(settingName, roomId, level, value, SettingsStore.getValue(settingName));
                    });
                }
            },
        );
        jest.spyOn(SettingsStore, "getValue").mockImplementation(
            (settingName: keyof Settings, _roomId: string | null = null, _excludeDefault = false) => {
                if (settingName == "acknowledgedHistoryVisibility") {
                    return acknowledgedHistoryVisibility;
                }
                if (settingName == "feature_share_history_on_invite") {
                    return true;
                }
                return SettingsStore.getDefaultValue(settingName);
            },
        );
        jest.spyOn(SettingsStore, "watchSetting").mockImplementation(
            (settingName: keyof Settings, roomId: string | null, callbackFn: CallbackFn) => {
                watcherCallbacks.push(callbackFn);
                return `mockWatcherId-${settingName}-${roomId}`;
            },
        );
    });

    const ROOM_ID = "!roomId:example.org";
    let room: Room;
    let client: MatrixClient;

    beforeEach(async () => {
        jest.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.safeGet();
        client.getSyncStateData = jest.fn().mockReturnValue({});
        client.setRoomAccountData = jest.fn().mockResolvedValue({});
        room = new Room(ROOM_ID, client, client.getUserId()!);

        await SettingsStore.setValue("acknowledgedHistoryVisibility", ROOM_ID, SettingLevel.ROOM_ACCOUNT, false);
    });

    const getComponent = () =>
        render(<HistoryVisibleBanner room={room} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
            ),
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
