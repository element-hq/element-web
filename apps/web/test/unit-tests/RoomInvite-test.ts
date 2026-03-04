/*
Copyright 2025 The Matrix.org Foundation C.I.C.

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

import { getMockClientWithEventEmitter } from "../test-utils";
import { inviteMultipleToRoom } from "../../src/RoomInvite.tsx";

afterEach(() => {
    jest.restoreAllMocks();
});

describe("inviteMultipleToRoom", () => {
    it("can be called wth no `options`", async () => {
        const client = getMockClientWithEventEmitter({});
        const { states, inviter } = await inviteMultipleToRoom(client, "!room:id", []);
        expect(states).toEqual({});

        // @ts-ignore reference to private property
        expect(inviter.options).toEqual({});
    });
});
