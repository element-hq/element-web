/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { HideActionButton } from "../../../../../src/components/views/messages/HideActionButton";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import type { Settings } from "../../../../../src/settings/Settings";

function mockSetting(
    showImages: Settings["showImages"]["default"],
    showMediaEventIds: Settings["showMediaEventIds"]["default"],
) {
    jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
        if (settingName === "showImages") {
            return showImages;
        } else if (settingName === "showMediaEventIds") {
            return showMediaEventIds;
        }
        throw Error(`Unexpected setting ${settingName}`);
    });
}

const event = new MatrixEvent({
    event_id: "$foo:bar",
    room_id: "!room:id",
    sender: "@user:id",
    type: "m.room.message",
    content: {
        body: "test",
        msgtype: "m.image",
        url: "mxc://matrix.org/1234",
    },
});

describe("HideActionButton", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it("should show button when event is visible by showMediaEventIds setting", async () => {
        mockSetting(false, { "$foo:bar": true });
        render(<HideActionButton mxEvent={event} />);
        expect(screen.getByRole("button")).toBeVisible();
    });
    it("should show button when event is visible by showImages setting", async () => {
        mockSetting(true, {});
        render(<HideActionButton mxEvent={event} />);
        expect(screen.getByRole("button")).toBeVisible();
    });
    it("should hide button when event is hidden by showMediaEventIds setting", async () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue({ "$foo:bar": false });
        render(<HideActionButton mxEvent={event} />);
        expect(screen.queryByRole("button")).toBeNull();
    });
    it("should hide button when event is hidden by showImages setting", async () => {
        mockSetting(false, {});
        render(<HideActionButton mxEvent={event} />);
        expect(screen.queryByRole("button")).toBeNull();
    });
    it("should store event as hidden when clicked", async () => {
        const spy = jest.spyOn(SettingsStore, "setValue");
        render(<HideActionButton mxEvent={event} />);
        fireEvent.click(screen.getByRole("button"));
        expect(spy).toHaveBeenCalledWith("showMediaEventIds", null, SettingLevel.DEVICE, { "$foo:bar": false });
        // Button should be hidden after the setting is set.
        expect(screen.queryByRole("button")).toBeNull();
    });
});
