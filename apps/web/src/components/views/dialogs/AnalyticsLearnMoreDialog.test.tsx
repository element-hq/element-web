/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { render } from "test-utils-rtl";
import React from "react";
import { vi, describe, it, expect } from "vitest";

import { AnalyticsLearnMoreDialog } from "./AnalyticsLearnMoreDialog.tsx";

describe("AnalyticsLearnMoreDialog", () => {
    it("should match snapshot", async () => {
        const { getByText, asFragment } = render(
            <AnalyticsLearnMoreDialog onFinished={vi.fn()} analyticsOwner="Element" />,
        );

        expect(getByText("Help improve Element")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });
});
