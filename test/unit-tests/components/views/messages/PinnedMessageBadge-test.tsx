/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render } from "jest-matrix-react";

import { PinnedMessageBadge } from "../../../../../src/components/views/messages/PinnedMessageBadge.tsx";

describe("PinnedMessageBadge", () => {
    it("should render", () => {
        const { asFragment } = render(<PinnedMessageBadge />);
        expect(asFragment()).toMatchSnapshot();
    });
});
