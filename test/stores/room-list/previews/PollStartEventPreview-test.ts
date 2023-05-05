/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { PollStartEventPreview } from "../../../../src/stores/room-list/previews/PollStartEventPreview";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { makePollStartEvent } from "../../../test-utils";

jest.spyOn(MatrixClientPeg, "get").mockReturnValue({
    getUserId: () => "@me:example.com",
    getSafeUserId: () => "@me:example.com",
} as unknown as MatrixClient);

describe("PollStartEventPreview", () => {
    it("shows the question for a poll I created", async () => {
        const pollStartEvent = makePollStartEvent("My Question", "@me:example.com");
        const preview = new PollStartEventPreview();
        expect(preview.getTextFor(pollStartEvent)).toBe("My Question");
    });

    it("shows the sender and question for a poll created by someone else", async () => {
        const pollStartEvent = makePollStartEvent("Your Question", "@yo:example.com");
        const preview = new PollStartEventPreview();
        expect(preview.getTextFor(pollStartEvent)).toBe("@yo:example.com: Your Question");
    });
});
