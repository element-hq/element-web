/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "test-utils-rtl";
import { createTestClient, mkStubRoom } from "test-utils";
import { MatrixEvent, type RoomMember } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect } from "vitest";

import LeaveSpaceDialog from "./LeaveSpaceDialog";

describe("LeaveSpaceDialog", () => {
    it("should warn about not being able to rejoin non-public space", () => {
        const mockClient = createTestClient();
        const mockSpace = mkStubRoom("myfakeroom", "myfakeroom", mockClient) as any;
        vi.spyOn(mockSpace.currentState, "getStateEvents").mockReturnValue(
            new MatrixEvent({
                type: "m.room.join_rules",
                content: {
                    join_rule: "invite",
                },
            }),
        );

        render(<LeaveSpaceDialog space={mockSpace} onFinished={vi.fn()} />);

        expect(screen.getByText(/You won't be able to rejoin unless you are re-invited/)).toBeInTheDocument();
    });

    it("should warn if user is the only admin", () => {
        const mockClient = createTestClient();
        const mockSpace = mkStubRoom("myfakeroom", "myfakeroom", mockClient) as any;
        vi.spyOn(mockSpace, "getJoinedMembers").mockReturnValue([
            { powerLevel: 100 } as unknown as RoomMember,
            { powerLevel: 0 } as unknown as RoomMember,
        ]);
        vi.spyOn(mockSpace, "getMember").mockReturnValue({
            powerLevel: 100,
        } as unknown as RoomMember);

        render(<LeaveSpaceDialog space={mockSpace} onFinished={vi.fn()} />);

        expect(
            screen.getByText(/You're the only admin of this space. Leaving it will mean no one has control over it./),
        ).toBeInTheDocument();
    });
});
