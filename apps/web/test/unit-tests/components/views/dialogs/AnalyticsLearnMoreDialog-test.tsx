/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import { AnalyticsLearnMoreDialog } from "../../../../../src/components/views/dialogs/AnalyticsLearnMoreDialog.tsx";

describe("AnalyticsLearnMoreDialog", () => {
    it("should match snapshot", async () => {
        const { getByText, asFragment } = render(
            <AnalyticsLearnMoreDialog onFinished={jest.fn()} analyticsOwner="Element" />,
        );

        expect(getByText("Help improve Element")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });
});
