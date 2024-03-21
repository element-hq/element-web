/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import userEvent from "@testing-library/user-event";
import { render, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@vector-im/compound-web";

import InfoTooltip from "../../../../src/components/views/elements/InfoTooltip";

describe("InfoTooltip", () => {
    it("should show tooltip on hover", async () => {
        const { getByText, asFragment } = render(<InfoTooltip tooltip="Tooltip text">Trigger text</InfoTooltip>, {
            wrapper: TooltipProvider,
        });

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
