/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render } from "test-utils-rtl";
import { clientAndSDKContextRenderOptions, createTestClient } from "test-utils";

import { RoomListSearch } from "./RoomListSearch";
import { MetaSpace } from "../../../../stores/spaces";
import { shouldShowComponent } from "../../../../customisations/helpers/UIComponents";
import { SDKContextClass } from "../../../../contexts/SDKContextClass.ts";

vi.mock("../../../../customisations/helpers/UIComponents", () => ({
    shouldShowComponent: vi.fn(),
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
        vi.mocked(shouldShowComponent).mockReturnValue(true);
        vi.spyOn(SDKContextClass.instance.legacyCallHandler, "getSupportsPstnProtocol").mockReturnValue(false);
    });

    it("renders", () => {
        const { asFragment } = renderComponent(MetaSpace.VideoRooms);
        expect(asFragment()).toMatchSnapshot();
    });
});
