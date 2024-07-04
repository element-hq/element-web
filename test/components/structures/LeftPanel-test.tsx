/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

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
import { render, RenderResult, screen } from "@testing-library/react";
import { mocked } from "jest-mock";

import LeftPanel from "../../../src/components/structures/LeftPanel";
import PageType from "../../../src/PageTypes";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { shouldShowComponent } from "../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../src/settings/UIFeature";

jest.mock("../../../src/customisations/helpers/UIComponents", () => ({
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
