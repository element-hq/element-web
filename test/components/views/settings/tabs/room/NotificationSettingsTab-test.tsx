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

import React from "react";
import { render, RenderResult, screen } from "@testing-library/react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import userEvent from "@testing-library/user-event";

import NotificationSettingsTab from "../../../../../../src/components/views/settings/tabs/room/NotificationSettingsTab";
import { mkStubRoom, stubClient } from "../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { EchoChamber } from "../../../../../../src/stores/local-echo/EchoChamber";
import { RoomEchoChamber } from "../../../../../../src/stores/local-echo/RoomEchoChamber";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../src/settings/SettingLevel";

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
