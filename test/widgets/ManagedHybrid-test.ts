/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { isManagedHybridWidgetEnabled } from "../../src/widgets/ManagedHybrid";
import DMRoomMap from "../../src/utils/DMRoomMap";
import { stubClient } from "../test-utils";
import SdkConfig from "../../src/SdkConfig";

describe("isManagedHybridWidgetEnabled", () => {
    let dmRoomMap: DMRoomMap;

    beforeEach(() => {
        stubClient();
        dmRoomMap = {
            getUserIdForRoomId: jest.fn().mockReturnValue("@user:server"),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);
    });

    it("should return false if widget_build_url is unset", () => {
        expect(isManagedHybridWidgetEnabled("!room:server")).toBeFalsy();
    });

    it("should return true for DMs when widget_build_url_ignore_dm is unset", () => {
        SdkConfig.put({
            widget_build_url: "https://url",
        });
        expect(isManagedHybridWidgetEnabled("!room:server")).toBeTruthy();
    });

    it("should return false for DMs when widget_build_url_ignore_dm is true", () => {
        SdkConfig.put({
            widget_build_url: "https://url",
            widget_build_url_ignore_dm: true,
        });
        expect(isManagedHybridWidgetEnabled("!room:server")).toBeFalsy();
    });
});
