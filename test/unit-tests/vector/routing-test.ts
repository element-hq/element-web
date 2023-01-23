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

import { onNewScreen } from "../../../src/vector/routing";

describe("onNewScreen", () => {
    it("should replace history if stripping via fields", () => {
        delete window.location;
        window.location = {
            hash: "#/room/!room:server?via=abc",
            replace: jest.fn(),
            assign: jest.fn(),
        } as unknown as Location;
        onNewScreen("room/!room:server");
        expect(window.location.assign).not.toHaveBeenCalled();
        expect(window.location.replace).toHaveBeenCalled();
    });

    it("should not replace history if changing rooms", () => {
        delete window.location;
        window.location = {
            hash: "#/room/!room1:server?via=abc",
            replace: jest.fn(),
            assign: jest.fn(),
        } as unknown as Location;
        onNewScreen("room/!room2:server");
        expect(window.location.assign).toHaveBeenCalled();
        expect(window.location.replace).not.toHaveBeenCalled();
    });
});
