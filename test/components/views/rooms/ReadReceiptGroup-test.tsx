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

import { determineAvatarPosition, readReceiptTooltip } from "../../../../src/components/views/rooms/ReadReceiptGroup";

describe("ReadReceiptGroup", () => {
    describe("TooltipText", () => {
        it("returns '...and more' with hasMore", () => {
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan", "Eve"], true)).toEqual(
                "Alice, Bob, Charlie, Dan, Eve and more",
            );
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan"], true)).toEqual(
                "Alice, Bob, Charlie, Dan and more",
            );
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie"], true)).toEqual("Alice, Bob, Charlie and more");
            expect(readReceiptTooltip(["Alice", "Bob"], true)).toEqual("Alice, Bob and more");
            expect(readReceiptTooltip(["Alice"], true)).toEqual("Alice and more");
            expect(readReceiptTooltip([], false)).toBeUndefined();
        });
        it("returns a pretty list without hasMore", () => {
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan", "Eve"], false)).toEqual(
                "Alice, Bob, Charlie, Dan and Eve",
            );
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan"], false)).toEqual(
                "Alice, Bob, Charlie and Dan",
            );
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie"], false)).toEqual("Alice, Bob and Charlie");
            expect(readReceiptTooltip(["Alice", "Bob"], false)).toEqual("Alice and Bob");
            expect(readReceiptTooltip(["Alice"], false)).toEqual("Alice");
            expect(readReceiptTooltip([], false)).toBeUndefined();
        });
    });
    describe("AvatarPosition", () => {
        // The avatar slots are numbered from right to left
        // That means currently, we’ve got the slots | 3 | 2 | 1 | 0 | each with 10px distance to the next one.
        // We want to fill slots so the first avatar is in the right-most slot without leaving any slots at the left
        // unoccupied.
        it("to handle the non-overflowing case correctly", () => {
            expect(determineAvatarPosition(0, 4)).toEqual({ hidden: false, position: 0 });

            expect(determineAvatarPosition(0, 4)).toEqual({ hidden: false, position: 0 });
            expect(determineAvatarPosition(1, 4)).toEqual({ hidden: false, position: 1 });

            expect(determineAvatarPosition(0, 4)).toEqual({ hidden: false, position: 0 });
            expect(determineAvatarPosition(1, 4)).toEqual({ hidden: false, position: 1 });
            expect(determineAvatarPosition(2, 4)).toEqual({ hidden: false, position: 2 });

            expect(determineAvatarPosition(0, 4)).toEqual({ hidden: false, position: 0 });
            expect(determineAvatarPosition(1, 4)).toEqual({ hidden: false, position: 1 });
            expect(determineAvatarPosition(2, 4)).toEqual({ hidden: false, position: 2 });
            expect(determineAvatarPosition(3, 4)).toEqual({ hidden: false, position: 3 });
        });

        it("to handle the overflowing case correctly", () => {
            expect(determineAvatarPosition(0, 4)).toEqual({ hidden: false, position: 0 });
            expect(determineAvatarPosition(1, 4)).toEqual({ hidden: false, position: 1 });
            expect(determineAvatarPosition(2, 4)).toEqual({ hidden: false, position: 2 });
            expect(determineAvatarPosition(3, 4)).toEqual({ hidden: false, position: 3 });
            expect(determineAvatarPosition(4, 4)).toEqual({ hidden: true, position: 0 });
            expect(determineAvatarPosition(5, 4)).toEqual({ hidden: true, position: 0 });
        });
    });
});
