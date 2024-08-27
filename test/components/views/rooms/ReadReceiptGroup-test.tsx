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

import React, { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { RoomMember } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import {
    determineAvatarPosition,
    ReadReceiptPerson,
    readReceiptTooltip,
} from "../../../../src/components/views/rooms/ReadReceiptGroup";
import * as languageHandler from "../../../../src/languageHandler";
import { stubClient } from "../../../test-utils";
import dispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";

describe("ReadReceiptGroup", () => {
    describe("TooltipText", () => {
        it("returns '...and more' with hasMore", () => {
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan", "Eve", "Fox"], 5)).toEqual(
                "Alice, Bob, Charlie, Dan, Eve and one other",
            );
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan", "Eve", "Fox"], 4)).toEqual(
                "Alice, Bob, Charlie, Dan and 2 others",
            );
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan"], 3)).toEqual(
                "Alice, Bob, Charlie and one other",
            );
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan", "Eve", "Fox"], 2)).toEqual(
                "Alice, Bob and 4 others",
            );
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan", "Eve", "Fox"], 1)).toEqual(
                "Alice and 5 others",
            );
            expect(readReceiptTooltip([], 1)).toBe("");
        });
        it("returns a pretty list without hasMore", () => {
            jest.spyOn(languageHandler, "getUserLanguage").mockReturnValue("en-GB");
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan", "Eve"], 5)).toEqual(
                "Alice, Bob, Charlie, Dan and Eve",
            );
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie", "Dan"], 4)).toEqual("Alice, Bob, Charlie and Dan");
            expect(readReceiptTooltip(["Alice", "Bob", "Charlie"], 5)).toEqual("Alice, Bob and Charlie");
            expect(readReceiptTooltip(["Alice", "Bob"], 5)).toEqual("Alice and Bob");
            expect(readReceiptTooltip(["Alice"], 5)).toEqual("Alice");
            expect(readReceiptTooltip([], 5)).toBe("");
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

    describe("<ReadReceiptPerson />", () => {
        stubClient();

        const ROOM_ID = "roomId";
        const USER_ID = "@alice:example.org";

        const member = new RoomMember(ROOM_ID, USER_ID);
        member.rawDisplayName = "Alice";
        member.getMxcAvatarUrl = () => "http://placekitten.com/400/400";

        const renderReadReceipt = (props?: Partial<ComponentProps<typeof ReadReceiptPerson>>) => {
            const currentDate = new Date(2024, 4, 15).getTime();
            return render(<ReadReceiptPerson userId={USER_ID} roomMember={member} ts={currentDate} {...props} />);
        };

        beforeEach(() => {
            jest.spyOn(dispatcher, "dispatch");
        });

        it("should render", () => {
            const { container } = renderReadReceipt();
            expect(container).toMatchSnapshot();
        });

        it("should display a tooltip", async () => {
            renderReadReceipt();

            await userEvent.hover(screen.getByRole("menuitem"));
            await waitFor(() => {
                const tooltip = screen.getByRole("tooltip", { name: member.rawDisplayName });
                expect(tooltip).toMatchSnapshot();
            });
        });

        it("should send an event when clicked", async () => {
            const onAfterClick = jest.fn();
            renderReadReceipt({ onAfterClick });

            screen.getByRole("menuitem").click();

            expect(onAfterClick).toHaveBeenCalled();
            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewUser,
                    member,
                    push: false,
                }),
            );
        });
    });
});
