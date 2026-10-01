/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render } from "test-utils-rtl";
import { describe, it, expect, vi, afterEach } from "vitest";

import { IntegrationsDisabledDialog } from "./IntegrationsDisabledDialog";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "./UserTab";

vi.mock("react-focus-lock");

describe("<IntegrationsDisabledDialog />", () => {
    const onFinished = vi.fn();

    afterEach(() => {
        vi.restoreAllMocks();
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
        vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        const { getByText } = renderComponent();
        fireEvent.click(getByText("Settings"));
        expect(onFinished).toHaveBeenCalled();
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Security,
        });
    });
});
