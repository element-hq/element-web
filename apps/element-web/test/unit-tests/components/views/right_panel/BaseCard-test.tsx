/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen } from "jest-matrix-react";

import BaseCard from "../../../../../src/components/views/right_panel/BaseCard.tsx";
import RightPanelStore from "../../../../../src/stores/right-panel/RightPanelStore.ts";

jest.mock("../../../../../src/stores/right-panel/RightPanelStore", () => ({
    instance: {
        popCard: jest.fn(),
        roomPhaseHistory: [],
    },
}));

describe("<BaseCard />", () => {
    it("should close when clicking X button", async () => {
        const { asFragment } = render(
            <BaseCard header="Heading text">
                <div>Content</div>
            </BaseCard>,
        );

        expect(screen.getByRole("heading")).toHaveTextContent("Heading text");
        expect(asFragment()).toMatchSnapshot();

        fireEvent.click(screen.getByTestId("base-card-close-button"));
        expect(RightPanelStore.instance.popCard).toHaveBeenCalled();
    });
});
