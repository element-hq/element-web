/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "test-utils-rtl";
import { clientAndSDKContextRenderOptions } from "test-utils";

import BaseCard from "./BaseCard";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { SDKContextClass } from "../../../contexts/SDKContextClass";

vi.mock("../../../stores/right-panel/RightPanelStore", () => ({
    default: {
        instance: {
            popCard: vi.fn(),
            currentCardPhaseHistory: [],
        },
    },
}));

describe("<BaseCard />", () => {
    it("should close when clicking X button", async () => {
        const { asFragment } = render(
            <BaseCard header="Heading text">
                <div>Content</div>
            </BaseCard>,
            clientAndSDKContextRenderOptions(SDKContextClass.instance.client!, SDKContextClass.instance),
        );

        expect(screen.getByRole("heading")).toHaveTextContent("Heading text");
        expect(asFragment()).toMatchSnapshot();

        fireEvent.click(screen.getByTestId("base-card-close-button"));
        expect(RightPanelStore.instance.popCard).toHaveBeenCalled();
    });
});
