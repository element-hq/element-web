import { determineAvatarPosition, readReceiptTooltip } from "../../../../src/components/views/rooms/ReadReceiptGroup";

describe("ReadReceiptGroup", () => {
    describe("TooltipText", () => {
        it("returns '...and more' with hasMore", () => {
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan", "Eve"], true))
                .toEqual("Alice, Bob, Charlie, Dan, Eve and more");
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan"], true))
                .toEqual("Alice, Bob, Charlie, Dan and more");
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie"], true))
                .toEqual("Alice, Bob, Charlie and more");
            expect(readReceiptTooltip(["Alice", "Bob"], true))
                .toEqual("Alice, Bob and more");
            expect(readReceiptTooltip(["Alice"], true))
                .toEqual("Alice and more");
            expect(readReceiptTooltip([], false))
                .toEqual(null);
        });
        it("returns a pretty list without hasMore", () => {
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan", "Eve"], false))
                .toEqual("Alice, Bob, Charlie, Dan and Eve");
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan"], false))
                .toEqual("Alice, Bob, Charlie and Dan");
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie"], false))
                .toEqual("Alice, Bob and Charlie");
            expect(readReceiptTooltip(["Alice", "Bob"], false))
                .toEqual("Alice and Bob");
            expect(readReceiptTooltip(["Alice"], false))
                .toEqual("Alice");
            expect(readReceiptTooltip([], false))
                .toEqual(null);
        });
    });
    describe("AvatarPosition", () => {
        // The avatar slots are numbered from right to left
        // That means currently, we’ve got the slots | 3 | 2 | 1 | 0 | each with 10px distance to the next one.
        // We want to fill slots so the first avatar is in the left-most slot without leaving any slots at the right
        // unoccupied.
        it("to handle the non-overflowing case correctly", () => {
            expect(determineAvatarPosition(0, 1, 4))
                .toEqual({ hidden: false, position: 0 });

            expect(determineAvatarPosition(0, 2, 4))
                .toEqual({ hidden: false, position: 1 });
            expect(determineAvatarPosition(1, 2, 4))
                .toEqual({ hidden: false, position: 0 });

            expect(determineAvatarPosition(0, 3, 4))
                .toEqual({ hidden: false, position: 2 });
            expect(determineAvatarPosition(1, 3, 4))
                .toEqual({ hidden: false, position: 1 });
            expect(determineAvatarPosition(2, 3, 4))
                .toEqual({ hidden: false, position: 0 });

            expect(determineAvatarPosition(0, 4, 4))
                .toEqual({ hidden: false, position: 3 });
            expect(determineAvatarPosition(1, 4, 4))
                .toEqual({ hidden: false, position: 2 });
            expect(determineAvatarPosition(2, 4, 4))
                .toEqual({ hidden: false, position: 1 });
            expect(determineAvatarPosition(3, 4, 4))
                .toEqual({ hidden: false, position: 0 });
        });

        it("to handle the overflowing case correctly", () => {
            expect(determineAvatarPosition(0, 6, 4))
                .toEqual({ hidden: false, position: 3 });
            expect(determineAvatarPosition(1, 6, 4))
                .toEqual({ hidden: false, position: 2 });
            expect(determineAvatarPosition(2, 6, 4))
                .toEqual({ hidden: false, position: 1 });
            expect(determineAvatarPosition(3, 6, 4))
                .toEqual({ hidden: false, position: 0 });
            expect(determineAvatarPosition(4, 6, 4))
                .toEqual({ hidden: true, position: 0 });
            expect(determineAvatarPosition(5, 6, 4))
                .toEqual({ hidden: true, position: 0 });
        });
    });
});
