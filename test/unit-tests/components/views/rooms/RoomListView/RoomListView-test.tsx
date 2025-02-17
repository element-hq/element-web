/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";

import { RoomListView } from "../../../../../../src/components/views/rooms/RoomListView";
import { shouldShowComponent } from "../../../../../../src/customisations/helpers/UIComponents";
import { MetaSpace } from "../../../../../../src/stores/spaces";

jest.mock("../../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("<RoomListView />", () => {
    function renderComponent() {
        return render(<RoomListView activeSpace={MetaSpace.Home} />);
    }

    beforeEach(() => {
        // By default, we consider shouldShowComponent(UIComponent.FilterContainer) should return true
        mocked(shouldShowComponent).mockReturnValue(true);
    });

    it("should render the RoomListSearch component when UIComponent.FilterContainer is at true", () => {
        const { asFragment } = renderComponent();
        expect(screen.getByRole("button", { name: "Search Ctrl K" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should not render the RoomListSearch component when UIComponent.FilterContainer is at false", () => {
        mocked(shouldShowComponent).mockReturnValue(false);
        const { asFragment } = renderComponent();

        expect(screen.queryByRole("button", { name: "Search Ctrl K" })).toBeNull();
        expect(asFragment()).toMatchSnapshot();
    });
});
