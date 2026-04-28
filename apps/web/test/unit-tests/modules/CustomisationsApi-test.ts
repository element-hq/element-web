/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { CustomisationsApi } from "../../../src/modules/customisationsApi";
import { UIComponent } from "../../../src/settings/UIFeature.ts";

describe("CustomisationsApi", () => {
    let api: CustomisationsApi;

    beforeEach(() => {
        api = new CustomisationsApi();
    });

    it("should register a shouldShowComponent callback", () => {
        const shouldShowComponent = jest.fn().mockReturnValue(true);
        api.registerShouldShowComponent(shouldShowComponent);
        expect(api.shouldShowComponent(UIComponent.CreateRooms)).toBe(true);
        expect(shouldShowComponent).toHaveBeenCalledWith("UIComponent.roomCreation");
    });
});
