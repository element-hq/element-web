/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";
import { MatrixEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { HideActionButton } from "../../../../../src/components/views/messages/HideActionButton";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import type { Settings } from "../../../../../src/settings/Settings";
import { MediaPreviewValue } from "../../../../../src/@types/media_preview";
import { getMockClientWithEventEmitter, withClientContextRenderOptions } from "../../../../test-utils";
import type { MockedObject } from "jest-mock";

function mockSetting(mediaPreviews: MediaPreviewValue, showMediaEventIds: Settings["showMediaEventIds"]["default"]) {
    jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => {
        if (settingName === "mediaPreviewConfig") {
            return { media_previews: mediaPreviews, invite_avatars: MediaPreviewValue.Off };
        } else if (settingName === "showMediaEventIds") {
            return showMediaEventIds;
        }
        throw Error(`Unexpected setting ${settingName}`);
    });
}

const EVENT_ID = "$foo:bar";

const event = new MatrixEvent({
    event_id: EVENT_ID,
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
    let cli: MockedObject<MatrixClient>;
    beforeEach(() => {
        cli = getMockClientWithEventEmitter({
            getRoom: jest.fn(),
            getUserId: jest.fn(),
        });
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    it("should show button when event is visible by showMediaEventIds setting", async () => {
        mockSetting(MediaPreviewValue.Off, { [EVENT_ID]: true });
        render(<HideActionButton mxEvent={event} />, withClientContextRenderOptions(cli));
        expect(screen.getByRole("button")).toBeVisible();
    });
    it("should show button when event is visible by mediaPreviewConfig setting", async () => {
        mockSetting(MediaPreviewValue.On, {});
        render(<HideActionButton mxEvent={event} />, withClientContextRenderOptions(cli));
        expect(screen.getByRole("button")).toBeVisible();
    });
    it("should hide button when event is hidden by showMediaEventIds setting", async () => {
        mockSetting(MediaPreviewValue.Off, { [EVENT_ID]: false });
        render(<HideActionButton mxEvent={event} />, withClientContextRenderOptions(cli));
        expect(screen.queryByRole("button")).toBeNull();
    });
    it("should hide button when event is hidden by showImages setting", async () => {
        mockSetting(MediaPreviewValue.Off, {});
        render(<HideActionButton mxEvent={event} />, withClientContextRenderOptions(cli));
        expect(screen.queryByRole("button")).toBeNull();
    });
    it("should store event as hidden when clicked", async () => {
        const spy = jest.spyOn(SettingsStore, "setValue");
        render(<HideActionButton mxEvent={event} />, withClientContextRenderOptions(cli));
        fireEvent.click(screen.getByRole("button"));
        expect(spy).toHaveBeenCalledWith("showMediaEventIds", null, SettingLevel.DEVICE, { "$foo:bar": false });
        // Button should be hidden after the setting is set.
        expect(screen.queryByRole("button")).toBeNull();
    });
});
