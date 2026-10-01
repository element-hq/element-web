/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, beforeEach, expect } from "vitest";
import React from "react";
import { render, screen } from "test-utils-rtl";

import { LargeLoader } from "./LargeLoader";

describe("LargeLoader", () => {
    const text = "test loading text";

    beforeEach(() => {
        render(<LargeLoader text={text} />);
    });

    it("should render the text", () => {
        expect(screen.getByText(text)).toBeVisible();
    });
});
