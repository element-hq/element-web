/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { mocked } from "jest-mock";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { Room, type RoomMember } from "matrix-js-sdk/src/matrix";

import { RoomSearchSenderFilter } from "../../../../../src/components/views/right_panel/RoomSearchSenderFilter";
import { stubClient } from "../../../../test-utils";

const member = (userId: string, name: string): RoomMember => ({ userId, name }) as RoomMember;

describe("RoomSearchSenderFilter", () => {
    const buildRoom = (members: RoomMember[]): Room => {
        const client = mocked(stubClient());
        const room = new Room("!r:server", client, "@me:server");
        jest.spyOn(room, "getJoinedMembers").mockReturnValue(members);
        return room;
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders the filter trigger when the room has other members", () => {
        render(
            <RoomSearchSenderFilter
                room={buildRoom([member("@alice:server", "Alice")])}
                senders={[]}
                onSearchSendersChange={jest.fn()}
            />,
        );

        expect(screen.getByTestId("search-sender-filter-button")).toBeInTheDocument();
    });

    it("renders nothing when the room has no other members", () => {
        const { container } = render(
            <RoomSearchSenderFilter
                room={buildRoom([member("@me:server", "Me")])}
                senders={[]}
                onSearchSendersChange={jest.fn()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it("selecting a member adds them to the sender filter", async () => {
        const onChange = jest.fn();
        render(
            <RoomSearchSenderFilter
                room={buildRoom([member("@alice:server", "Alice"), member("@bob:server", "Bob")])}
                senders={[]}
                onSearchSendersChange={onChange}
            />,
        );

        await userEvent.click(screen.getByTestId("search-sender-filter-button"));
        await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Alice" }));

        expect(onChange).toHaveBeenCalledWith(["@alice:server"]);
    });

    it("toggling an already-selected member off removes them", async () => {
        const onChange = jest.fn();
        render(
            <RoomSearchSenderFilter
                room={buildRoom([member("@alice:server", "Alice"), member("@bob:server", "Bob")])}
                senders={["@alice:server", "@bob:server"]}
                onSearchSendersChange={onChange}
            />,
        );

        await userEvent.click(screen.getByTestId("search-sender-filter-button"));
        await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Alice" }));

        expect(onChange).toHaveBeenCalledWith(["@bob:server"]);
    });

    it("accumulates multiple senders when toggled in one pass (controlled usage)", async () => {
        // The real parent (RoomView) is controlled: onSearchSendersChange updates the senders prop. Mirror that with
        // a stateful wrapper to prove rapid multi-select accumulates rather than replacing the previous selection.
        const Wrapper = (): React.JSX.Element => {
            const [senders, setSenders] = React.useState<string[]>([]);
            return (
                <RoomSearchSenderFilter
                    room={buildRoom([member("@alice:server", "Alice"), member("@bob:server", "Bob")])}
                    senders={senders}
                    onSearchSendersChange={setSenders}
                />
            );
        };
        render(<Wrapper />);

        await userEvent.click(screen.getByTestId("search-sender-filter-button"));
        await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Alice" }));
        await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Bob" }));

        // Both checkboxes remain checked (menu stays open via preventDefault); neither selection was lost.
        expect(screen.getByRole("menuitemcheckbox", { name: "Alice" })).toBeChecked();
        expect(screen.getByRole("menuitemcheckbox", { name: "Bob" })).toBeChecked();
    });

    it("announces the active sender count on the trigger for screen readers", () => {
        render(
            <RoomSearchSenderFilter
                room={buildRoom([member("@alice:server", "Alice"), member("@bob:server", "Bob")])}
                senders={["@alice:server", "@bob:server"]}
                onSearchSendersChange={jest.fn()}
            />,
        );

        expect(screen.getByTestId("search-sender-filter-button")).toHaveAccessibleName(/2/);
    });

    it("clears all selected senders via the clear action", async () => {
        const onChange = jest.fn();
        render(
            <RoomSearchSenderFilter
                room={buildRoom([member("@alice:server", "Alice")])}
                senders={["@alice:server"]}
                onSearchSendersChange={onChange}
            />,
        );

        await userEvent.click(screen.getByTestId("search-sender-filter-button"));
        await userEvent.click(await screen.findByTestId("search-sender-filter-clear"));

        expect(onChange).toHaveBeenCalledWith([]);
    });
});
