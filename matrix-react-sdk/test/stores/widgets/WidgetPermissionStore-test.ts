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

import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { Widget, WidgetKind } from "matrix-widget-api";

import { OIDCState, WidgetPermissionStore } from "../../../src/stores/widgets/WidgetPermissionStore";
import SettingsStore from "../../../src/settings/SettingsStore";
import { TestSdkContext } from "../../TestSdkContext";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import { stubClient } from "../../test-utils";

jest.mock("../../../src/settings/SettingsStore");

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
});
