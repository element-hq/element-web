/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "@testing-library/react";

import { LiveBadge } from "../../../../src/voice-broadcast";

describe("LiveBadge", () => {
    it("should render as expected with default props", () => {
        const { container } = render(<LiveBadge />);
        expect(container).toMatchSnapshot();
    });

    it("should render in grey as expected", () => {
        const { container } = render(<LiveBadge grey={true} />);
        expect(container).toMatchSnapshot();
    });
});
