/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, type RenderResult, screen } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import NotificationSettingsTab from "../../../../../../../src/components/views/settings/tabs/room/NotificationSettingsTab";
import { mkStubRoom, stubClient } from "../../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../../src/MatrixClientPeg";
import { EchoChamber } from "../../../../../../../src/stores/local-echo/EchoChamber";
import { type RoomEchoChamber } from "../../../../../../../src/stores/local-echo/RoomEchoChamber";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../../src/settings/SettingLevel";

describe("NotificatinSettingsTab", () => {
    const roomId = "!room:example.com";
    let cli: MatrixClient;
    let roomProps: RoomEchoChamber;

    const renderTab = (): RenderResult => {
        return render(<NotificationSettingsTab roomId={roomId} closeSettingsFn={() => {}} />);
    };

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        const room = mkStubRoom(roomId, "test room", cli);
        roomProps = EchoChamber.forRoom(room);

        NotificationSettingsTab.contextType = React.createContext<MatrixClient>(cli);
    });

    it("should prevent »Settings« link click from bubbling up to radio buttons", async () => {
        const tab = renderTab();

        // settings link of mentions_only volume
        const settingsLink = tab.container.querySelector(
            "label.mx_NotificationSettingsTab_mentionsKeywordsEntry div.mx_AccessibleButton",
        );
        if (!settingsLink) throw new Error("settings link does not exist.");

        await userEvent.click(settingsLink);

        expect(roomProps.notificationVolume).not.toBe("mentions_only");
    });

    it("should show the currently chosen custom notification sound", async () => {
        SettingsStore.setValue("notificationSound", roomId, SettingLevel.ACCOUNT, {
            url: "mxc://server/custom-sound-123",
            name: "custom-sound-123",
        });
        renderTab();

        await screen.findByText("custom-sound-123");
    });

    it("should show the currently chosen custom notification sound url if no name", async () => {
        SettingsStore.setValue("notificationSound", roomId, SettingLevel.ACCOUNT, {
            url: "mxc://server/custom-sound-123",
        });
        renderTab();

        await screen.findByText("http://this.is.a.url/server/custom-sound-123");
    });
});
