/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render } from "test-utils-rtl";
import { describe, it, expect } from "vitest";

import InviteProgressBody from "./InviteProgressBody.tsx";

describe("InviteProgressBody", () => {
    it("should match snapshot", () => {
        const { asFragment } = render(<InviteProgressBody />);
        expect(asFragment()).toMatchSnapshot();
    });
});
