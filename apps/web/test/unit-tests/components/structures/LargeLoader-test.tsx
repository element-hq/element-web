/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import { LargeLoader } from "../../../../src/components/structures/LargeLoader";

describe("LargeLoader", () => {
    const text = "test loading text";

    beforeEach(() => {
        render(<LargeLoader text={text} />);
    });

    it("should render the text", () => {
        screen.getByText(text);
    });
});
