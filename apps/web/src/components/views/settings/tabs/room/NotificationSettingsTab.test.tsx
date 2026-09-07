/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, type RenderResult, screen, within } from "test-utils-rtl";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { mkStubRoom, stubClient } from "test-utils";

import NotificationSettingsTab from "./NotificationSettingsTab";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import { EchoChamber } from "../../../../../stores/local-echo/EchoChamber";
import { type RoomEchoChamber } from "../../../../../stores/local-echo/RoomEchoChamber";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";

describe("NotificationSettingsTab", () => {
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

    afterEach(() => {
        SettingsStore.reset();
    });

    it("should prevent »Settings« link click from bubbling up to radio buttons", async () => {
        const tab = renderTab();

        // settings link of mentions_only volume
        const settingsLink = within(tab.getByText("@mentions and replies only")).getByRole("button", {
            name: "settings",
        });
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

        await expect(screen.findByText("custom-sound-123")).resolves.toBeVisible();
    });

    it("should show the currently chosen custom notification sound url if no name", async () => {
        SettingsStore.setValue("notificationSound", roomId, SettingLevel.ACCOUNT, {
            url: "mxc://server/custom-sound-123",
        });
        renderTab();

        await expect(screen.findByText("http://this.is.a.url/server/custom-sound-123")).resolves.toBeVisible();
    });
});
