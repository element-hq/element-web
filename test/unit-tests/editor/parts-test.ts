/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EmojiPart, PlainPart } from "../../../src/editor/parts";
import { createPartCreator } from "./mock";

describe("editor/parts", () => {
    describe("appendUntilRejected", () => {
        const femaleFacepalmEmoji = "🤦‍♀️";

        it("should not accept emoji strings into type=plain", () => {
            const part = new PlainPart();
            expect(part.appendUntilRejected(femaleFacepalmEmoji, "")).toEqual(femaleFacepalmEmoji);
            expect(part.text).toEqual("");
        });

        it("should accept emoji strings into type=emoji", () => {
            const part = new EmojiPart();
            expect(part.appendUntilRejected(femaleFacepalmEmoji, "")).toBeUndefined();
            expect(part.text).toEqual(femaleFacepalmEmoji);
        });
    });

    it("should not explode on room pills for unknown rooms", () => {
        const pc = createPartCreator();
        const part = pc.roomPill("#room:server");
        expect(() => part.toDOMNode()).not.toThrow();
    });
});
