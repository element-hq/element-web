/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";

import { UserStatusIcon } from "./UserStatusIcon";
import { useUserStatus } from "../hooks/useUserStatus";

vi.mock("../hooks/useUserStatus");

const userId = "@alice:example.com";

describe("UserStatusIcon", () => {
    it("renders nothing when the user has no status", () => {
        vi.mocked(useUserStatus).mockReturnValue(undefined);

        const { container } = render(<UserStatusIcon userId={userId} />);

        expect(container).toBeEmptyDOMElement();
    });

    it("renders the status emoji", () => {
        vi.mocked(useUserStatus).mockReturnValue({ emoji: "🐎", text: "on a horse" });

        render(<UserStatusIcon userId={userId} />);

        expect(screen.getByText("🐎")).toBeInTheDocument();
        expect(useUserStatus).toHaveBeenCalledWith(userId);
    });

    it("shows the status text in a tooltip on hover", async () => {
        vi.mocked(useUserStatus).mockReturnValue({ emoji: "🐎", text: "on a horse" });

        render(<UserStatusIcon userId={userId} />);

        await userEvent.hover(screen.getByText("🐎"));
        await waitFor(() => {
            expect(screen.getByRole("tooltip")).toHaveTextContent("on a horse");
        });
    });
});
