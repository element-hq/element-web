/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { PollStartEventPreview } from "../../../../../src/stores/room-list/previews/PollStartEventPreview";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { makePollStartEvent } from "../../../../test-utils";

jest.spyOn(MatrixClientPeg, "get").mockReturnValue({
    getUserId: () => "@me:example.com",
    getSafeUserId: () => "@me:example.com",
} as unknown as MatrixClient);
jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue({
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
