/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";

import type { IWidget } from "matrix-widget-api";
import type { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { WidgetApi } from "../../../src/modules/WidgetApi";
import WidgetStore from "../../../src/stores/WidgetStore";
import { WidgetLayoutStore } from "../../../src/stores/widgets/WidgetLayoutStore";
import { stubClient } from "../../test-utils";

describe("WidgetApi", () => {
    let client: MatrixClient;
    let api: WidgetApi;

    const mkWidget = (overrides: Partial<IWidget> = {}): IWidget => ({
        id: "widget-id",
        creatorUserId: "@alice:example.org",
        type: "m.custom",
        url: "https://example.org/widget",
        ...overrides,
    });

    beforeEach(() => {
        client = stubClient();

        api = new WidgetApi();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("getWidgetsInRoom returns widgets from WidgetStore", () => {
        const widgets = [{ id: "w1" }, { id: "w2" }] as unknown as IWidget[];
        const getAppsSpy = jest.spyOn(WidgetStore.instance, "getApps").mockReturnValue(widgets as any);

        expect(api.getWidgetsInRoom("!room:example.org")).toBe(widgets);
        expect(getAppsSpy).toHaveBeenCalledWith("!room:example.org");
    });

    it("getAppAvatarUrl returns the http avatar URL for a widget if it has one", () => {
        const app = {
            ...mkWidget(),
            roomId: "!room:example.org",
            avatar_url: "mxc://example.org/avatar",
        } as unknown as IWidget;

        mocked(client.getHomeserverUrl).mockReturnValue("https://hs.example.org");
        const avatarUrl = api.getAppAvatarUrl(app, 32, 32, "scale");

        expect(avatarUrl).toContain("https://hs.example.org/_matrix/media/");
        expect(avatarUrl).toContain("/thumbnail/example.org/avatar");
        expect(avatarUrl).toContain("width=32");
        expect(avatarUrl).toContain("height=32");
        expect(avatarUrl).toContain("method=scale");
    });

    it("getAppAvatarUrl returns null when app is not an app widget", () => {
        const nonAppWidget = {
            ...mkWidget(),
            avatar_url: "mxc://example.org/avatar",
        };

        expect(api.getAppAvatarUrl(nonAppWidget)).toBeNull();
    });

    it("getAppAvatarUrl returns null when app has no avatar URL", () => {
        const appWithoutAvatar = {
            ...mkWidget(),
            roomId: "!room:example.org",
        } as unknown as IWidget;

        expect(api.getAppAvatarUrl(appWithoutAvatar)).toBeNull();
    });

    it("isAppInContainer returns false when room is not found", () => {
        const isInContainerSpy = jest.spyOn(WidgetLayoutStore.instance, "isInContainer");
        const app = mkWidget();

        mocked(client.getRoom).mockReturnValue(null);
        expect(api.isAppInContainer(app, "top", "!missing:example.org")).toBe(false);
        expect(isInContainerSpy).not.toHaveBeenCalled();
    });

    it("isAppInContainer delegates to WidgetLayoutStore when room exists", () => {
        const room = { roomId: "!room:example.org" } as Room;
        mocked(client.getRoom).mockReturnValue(room);
        const isInContainerSpy = jest.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(true);
        const app = mkWidget();

        expect(api.isAppInContainer(app, "top", room.roomId)).toBe(true);
        expect(isInContainerSpy).toHaveBeenCalledWith(room, app, "top");
    });

    it("moveAppToContainer does nothing when room is not found", () => {
        const moveToContainerSpy = jest.spyOn(WidgetLayoutStore.instance, "moveToContainer");
        const app = mkWidget();

        mocked(client.getRoom).mockReturnValue(null);
        api.moveAppToContainer(app, "right", "!missing:example.org");

        expect(moveToContainerSpy).not.toHaveBeenCalled();
    });

    it("moveAppToContainer delegates to WidgetLayoutStore when room exists", () => {
        const room = { roomId: "!room:example.org" } as Room;
        mocked(client.getRoom).mockReturnValue(room);
        const moveToContainerSpy = jest.spyOn(WidgetLayoutStore.instance, "moveToContainer").mockImplementation();
        const app = mkWidget();

        api.moveAppToContainer(app, "right", room.roomId);

        expect(moveToContainerSpy).toHaveBeenCalledWith(room, app, "right");
    });
});
