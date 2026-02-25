/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { fireEvent, render } from "jest-matrix-react";

import { IntegrationsDisabledDialog } from "../../../../../src/components/views/dialogs/IntegrationsDisabledDialog.tsx";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher.ts";
import { Action } from "../../../../../src/dispatcher/actions.ts";
import { UserTab } from "../../../../../src/components/views/dialogs/UserTab.ts";

describe("<IntegrationsDisabledDialog />", () => {
    const onFinished = jest.fn();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function renderComponent() {
        return render(<IntegrationsDisabledDialog onFinished={onFinished} />);
    }

    it("should render as expected", () => {
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();
    });
    it("should do nothing on clicking OK", () => {
        const { getByText } = renderComponent();
        fireEvent.click(getByText("OK"));
        expect(onFinished).toHaveBeenCalled();
    });
    it("should open the correct user settings tab on clicking Settings", () => {
        jest.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        const { getByText } = renderComponent();
        fireEvent.click(getByText("Settings"));
        expect(onFinished).toHaveBeenCalled();
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Security,
        });
    });
});
