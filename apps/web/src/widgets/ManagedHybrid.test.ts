/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import fetchMock from "@fetch-mock/vitest";
import { stubClient } from "test-utils";

import { addManagedHybridWidget, isManagedHybridWidgetEnabled } from "./ManagedHybrid";
import SdkConfig from "../SdkConfig";
import WidgetUtils from "../utils/WidgetUtils";
import { WidgetLayoutStore } from "../stores/widgets/WidgetLayoutStore";

vi.mock("../utils/room/getJoinedNonFunctionalMembers", () => ({
    getJoinedNonFunctionalMembers: vi.fn().mockReturnValue([1, 2]),
}));

describe("isManagedHybridWidgetEnabled", () => {
    let room: Room;

    beforeEach(() => {
        const client = stubClient();
        room = new Room("!room:server", client, client.getSafeUserId());
    });

    it("should return false if widget_build_url is unset", () => {
        expect(isManagedHybridWidgetEnabled(room)).toBeFalsy();
    });

    it("should return true for 1-1 rooms when widget_build_url_ignore_dm is unset", () => {
        SdkConfig.put({
            widget_build_url: "https://url",
        });
        expect(isManagedHybridWidgetEnabled(room)).toBeTruthy();
    });

    it("should return false for 1-1 rooms when widget_build_url_ignore_dm is true", () => {
        SdkConfig.put({
            widget_build_url: "https://url",
            widget_build_url_ignore_dm: true,
        });
        expect(isManagedHybridWidgetEnabled(room)).toBeFalsy();
    });
});

describe("addManagedHybridWidget", () => {
    let room: Room;

    beforeEach(() => {
        const client = stubClient();
        room = new Room("!room:server", client, client.getSafeUserId());
    });

    it("should noop if user lacks permission", async () => {
        const logSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
        vi.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(false);

        fetchMock.mockClear();
        await addManagedHybridWidget(room);
        expect(logSpy).toHaveBeenCalledWith("User not allowed to modify widgets in !room:server");
        expect(fetchMock).toHaveFetchedTimes(0);
    });

    it("should noop if no widget_build_url", async () => {
        vi.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);

        fetchMock.mockClear();
        await addManagedHybridWidget(room);
        expect(fetchMock).toHaveFetchedTimes(0);
    });

    it("should add the widget successfully", async () => {
        fetchMock.get("https://widget-build-url/?roomId=!room:server", {
            widget_id: "WIDGET_ID",
            widget: { key: "value" },
        });
        vi.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);
        vi.spyOn(WidgetLayoutStore.instance, "canCopyLayoutToRoom").mockReturnValue(true);
        const setRoomWidgetContentSpy = vi.spyOn(WidgetUtils, "setRoomWidgetContent").mockResolvedValue();
        SdkConfig.put({
            widget_build_url: "https://widget-build-url",
        });

        await addManagedHybridWidget(room);
        expect(fetchMock).toHaveFetched("https://widget-build-url?roomId=!room:server");
        expect(setRoomWidgetContentSpy).toHaveBeenCalledWith(room.client, room.roomId, "WIDGET_ID", {
            "key": "value",
            "io.element.managed_hybrid": true,
        });
    });
});
