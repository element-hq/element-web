/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createAudioContext } from "../../../src/audio/compat";

describe("createAudioContext", () => {
    it("should throw if AudioContext is not supported", () => {
        window.AudioContext = undefined as any;
        expect(createAudioContext).toThrow("Unsupported browser");
    });
});
