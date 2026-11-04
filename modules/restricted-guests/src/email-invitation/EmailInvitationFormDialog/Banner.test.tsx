/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { Banner } from "./Banner";
import { mockApi } from "../../tests/mockApi";

describe("Banner", () => {
    it.each([true, false])("renders when hasAccessToChatHistory=%s", (hasAccessToChatHistory) => {
        const { container } = render(<Banner api={mockApi} hasAccessToChatHistory={hasAccessToChatHistory} />);
        expect(container).toMatchSnapshot();
    });
});
