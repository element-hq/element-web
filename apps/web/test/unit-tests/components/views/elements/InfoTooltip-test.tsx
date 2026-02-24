/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import userEvent from "@testing-library/user-event";
import { render, waitFor } from "jest-matrix-react";

import InfoTooltip from "../../../../../src/components/views/elements/InfoTooltip";

describe("InfoTooltip", () => {
    it("should show tooltip on hover", async () => {
        const { getByText, asFragment } = render(<InfoTooltip tooltip="Tooltip text">Trigger text</InfoTooltip>);

        const trigger = getByText("Trigger text");
        expect(trigger).toBeVisible();
        await userEvent.hover(trigger!);

        // wait for the tooltip to open
        const tooltip = await waitFor(() => {
            const tooltip = document.getElementById(trigger.getAttribute("aria-describedby")!);
            expect(tooltip).toBeVisible();
            return tooltip;
        });
        expect(tooltip).toHaveTextContent("Tooltip text");

        expect(asFragment()).toMatchSnapshot();
    });
});
