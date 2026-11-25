/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "test-utils-rtl";
import * as TestUtils from "test-utils";

import FontScalingPanel from "./FontScalingPanel";

describe("FontScalingPanel", () => {
    it("renders the font scaling UI", () => {
        TestUtils.stubClient();
        const { asFragment } = render(<FontScalingPanel />);
        expect(asFragment()).toMatchSnapshot();
    });
});
