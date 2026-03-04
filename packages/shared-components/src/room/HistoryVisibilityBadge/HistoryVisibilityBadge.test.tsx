/*
 * Copyright (c) 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { HistoryVisibilityBadge } from "./HistoryVisibilityBadge.tsx";

describe("HistoryVisibilityBadge", () => {
    for (const visibility of ["invited", "joined", "shared", "world_readable"]) {
        it(`renders the badge for ${visibility}`, () => {
            const { container } = render(<HistoryVisibilityBadge historyVisibility={visibility as any} />);
            expect(container).toMatchSnapshot();
        });
    }
});
