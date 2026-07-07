/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@test-utils";

import { UserStatusIconView } from "./UserStatusIconView";

describe("UserStatusIconView", () => {
    it("renders the status emoji", () => {
        render(<UserStatusIconView status={{ emoji: "💡", text: "Having an idea" }} />);
        expect(screen.getByText("💡")).toBeInTheDocument();
    });

    it("renders only the first grapheme of a malformed multi-emoji status", () => {
        render(<UserStatusIconView status={{ emoji: "💡🎉", text: "Two emoji" }} />);
        expect(screen.getByText("💡")).toBeInTheDocument();
    });
});
