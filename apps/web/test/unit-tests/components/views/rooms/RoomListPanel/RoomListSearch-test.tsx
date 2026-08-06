/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";
import { mocked } from "jest-mock";

import { RoomListSearch } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListSearch";
import { MetaSpace } from "../../../../../../src/stores/spaces";
import { shouldShowComponent } from "../../../../../../src/customisations/helpers/UIComponents";
import { SDKContextClass } from "../../../../../../src/contexts/SDKContextClass.ts";
import { clientAndSDKContextRenderOptions, createTestClient } from "../../../../../test-utils";

jest.mock("../../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("<RoomListSearch />", () => {
    function renderComponent(activeSpace = MetaSpace.Home) {
        return render(
            <RoomListSearch activeSpace={activeSpace} />,
            clientAndSDKContextRenderOptions(createTestClient(), SDKContextClass.instance),
        );
    }

    beforeEach(() => {
        // By default, we consider shouldShowComponent(UIComponent.ExploreRooms) should return true
        mocked(shouldShowComponent).mockReturnValue(true);
        jest.spyOn(SDKContextClass.instance.legacyCallHandler, "getSupportsPstnProtocol").mockReturnValue(false);
    });

    it("renders", () => {
        const { asFragment } = renderComponent(MetaSpace.VideoRooms);
        expect(asFragment()).toMatchSnapshot();
    });
});
