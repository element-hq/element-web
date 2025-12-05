/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { Widget, WidgetKind } from "matrix-widget-api";

import { OIDCState, WidgetPermissionStore } from "../../../../src/stores/widgets/WidgetPermissionStore";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { TestSdkContext } from "../../TestSdkContext";
import { type SettingLevel } from "../../../../src/settings/SettingLevel";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import { stubClient } from "../../../test-utils";
import { StopGapWidgetDriver } from "../../../../src/stores/widgets/StopGapWidgetDriver";
import { WidgetType } from "../../../../src/widgets/WidgetType.ts";

jest.mock("../../../../src/settings/SettingsStore");

describe("WidgetPermissionStore", () => {
    let widgetPermissionStore: WidgetPermissionStore;
    let mockClient: MatrixClient;
    const userId = "@alice:localhost";
    const roomId = "!room:localhost";
    const w = new Widget({
        id: "wid",
        creatorUserId: userId,
        type: "m.custom",
        url: "https://invalid.address.here",
    });
    const elementCallWidget = new Widget({
        id: "group_call",
        creatorUserId: "@alice:example.org",
        type: WidgetType.CALL.preferred,
        url: "https://call.element.io",
    });
    let settings: Record<string, any> = {}; // key value store

    beforeEach(() => {
        settings = {}; // clear settings
        mocked(SettingsStore.getValue).mockImplementation((setting: string) => {
            return settings[setting];
        });
        mocked(SettingsStore.setValue).mockImplementation(
            (settingName: string, roomId: string | null, level: SettingLevel, value: any): Promise<void> => {
                // the store doesn't use any specific level or room ID (room IDs are packed into keys in `value`)
                settings[settingName] = value;
                return Promise.resolve();
            },
        );
        mockClient = stubClient();
        const context = new TestSdkContext();
        context.client = mockClient;
        widgetPermissionStore = new WidgetPermissionStore(context);
    });

    it("should persist OIDCState.Allowed for a widget", () => {
        widgetPermissionStore.setOIDCState(w, WidgetKind.Account, roomId, OIDCState.Allowed);
        // check it remembered the value
        expect(widgetPermissionStore.getOIDCState(w, WidgetKind.Account, roomId)).toEqual(OIDCState.Allowed);
    });

    it("should persist OIDCState.Denied for a widget", () => {
        widgetPermissionStore.setOIDCState(w, WidgetKind.Account, roomId, OIDCState.Denied);
        // check it remembered the value
        expect(widgetPermissionStore.getOIDCState(w, WidgetKind.Account, roomId)).toEqual(OIDCState.Denied);
    });

    it("should update OIDCState for a widget", () => {
        widgetPermissionStore.setOIDCState(w, WidgetKind.Account, roomId, OIDCState.Allowed);
        widgetPermissionStore.setOIDCState(w, WidgetKind.Account, roomId, OIDCState.Denied);
        // check it remembered the latest value
        expect(widgetPermissionStore.getOIDCState(w, WidgetKind.Account, roomId)).toEqual(OIDCState.Denied);
    });

    it("should scope the location for a widget when setting OIDC state", () => {
        // allow this widget for this room
        widgetPermissionStore.setOIDCState(w, WidgetKind.Room, roomId, OIDCState.Allowed);
        // check it remembered the value
        expect(widgetPermissionStore.getOIDCState(w, WidgetKind.Room, roomId)).toEqual(OIDCState.Allowed);
        // check this is not the case for the entire account
        expect(widgetPermissionStore.getOIDCState(w, WidgetKind.Account, roomId)).toEqual(OIDCState.Unknown);
    });
    it("is created once in SdkContextClass", () => {
        const context = new SdkContextClass();
        const store = context.widgetPermissionStore;
        expect(store).toBeDefined();
        const store2 = context.widgetPermissionStore;
        expect(store2).toStrictEqual(store);
    });
    it("auto-approves OIDC requests for element-call", async () => {
        new StopGapWidgetDriver([], elementCallWidget, WidgetKind.Room, true, roomId);
        expect(widgetPermissionStore.getOIDCState(elementCallWidget, WidgetKind.Room, roomId)).toEqual(
            OIDCState.Allowed,
        );
    });
});
