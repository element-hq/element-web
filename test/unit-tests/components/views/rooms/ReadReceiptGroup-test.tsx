/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { render, screen, waitFor } from "jest-matrix-react";
import { RoomMember } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import {
    determineAvatarPosition,
    ReadReceiptPerson,
    readReceiptTooltip,
} from "../../../../../src/components/views/rooms/ReadReceiptGroup";
import * as languageHandler from "../../../../../src/languageHandler";
import { stubClient } from "../../../../test-utils";
import dispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { formatDate } from "../../../../../src/DateUtils";

jest.mock("../../../../../src/DateUtils");

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

        // We pick a fixed time but this can still vary depending on the locale
        // the tests are run in. We are not testing date formatting here, so stub it out.
        mocked(formatDate).mockReturnValue("==MOCK FORMATTED DATE==");

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
                const tooltip = screen.getByRole("tooltip");
                expect(tooltip.textContent).toMatch(new RegExp(member.rawDisplayName));
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
