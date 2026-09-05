/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "test-utils-rtl";

import SessionRestoreErrorDialog from "./SessionRestoreErrorDialog";

describe("<SessionRestoreErrorDialog />", () => {
    it("should render", () => {
        const { asFragment } = render(
            <SessionRestoreErrorDialog error={new Error("it broke")} onFinished={() => {}} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
