/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EncryptedFile } from "matrix-js-sdk/src/types";

import { createVoiceMessageContent } from "../../../src/utils/createVoiceMessageContent";

describe("createVoiceMessageContent", () => {
    it("should create a voice message content", () => {
        expect(
            createVoiceMessageContent(
                "mxc://example.com/file",
                "ogg/opus",
                23000,
                42000,
                {} as unknown as EncryptedFile,
                [1, 2, 3],
            ),
        ).toMatchSnapshot();
    });
});
