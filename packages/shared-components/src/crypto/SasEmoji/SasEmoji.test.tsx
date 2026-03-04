/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@test-utils";

import { SasEmoji } from "./SasEmoji";

describe("<SasEmoji/>", () => {
    it("should match snapshot", () => {
        const { asFragment } = render(<SasEmoji emoji={["🦋", "🍄", "⚽", "🌏", "🦄", "🚀", "🔧"]} />);
        expect(asFragment()).toMatchSnapshot();
    });
});
