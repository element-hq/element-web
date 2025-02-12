/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, type RenderResult, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";

import LeftPanel from "../../../../src/components/structures/LeftPanel";
import PageType from "../../../../src/PageTypes";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { shouldShowComponent } from "../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../src/settings/UIFeature";

jest.mock("../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("LeftPanel", () => {
    function renderComponent(): RenderResult {
        return render(
            <LeftPanel isMinimized={false} pageType={PageType.RoomView} resizeNotifier={new ResizeNotifier()} />,
        );
    }

    it("does not show filter container when disabled by UIComponent customisations", () => {
        mocked(shouldShowComponent).mockReturnValue(false);
        renderComponent();
        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.FilterContainer);
        expect(screen.queryByRole("button", { name: /search/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Explore rooms" })).not.toBeInTheDocument();
    });

    it("renders filter container when enabled by UIComponent customisations", () => {
        mocked(shouldShowComponent).mockReturnValue(true);
        renderComponent();
        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.FilterContainer);
        expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Explore rooms" })).toBeInTheDocument();
    });
});
