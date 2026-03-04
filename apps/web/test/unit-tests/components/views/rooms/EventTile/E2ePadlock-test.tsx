/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import { E2ePadlock, E2ePadlockIcon } from "../../../../../../src/components/views/rooms/EventTile/E2ePadlock.tsx";

describe("E2ePadlock", () => {
    it("renders a 'Normal' icon", () => {
        const result = render(<E2ePadlock icon={E2ePadlockIcon.Normal} title="Test tooltip" />);
        expect(result.asFragment()).toMatchSnapshot();
    });

    it("renders a 'Warning' icon", () => {
        const result = render(<E2ePadlock icon={E2ePadlockIcon.Warning} title="Bad" />);
        expect(result.asFragment()).toMatchSnapshot();
    });

    it("renders a 'DecryptionFailure' icon", () => {
        const result = render(<E2ePadlock icon={E2ePadlockIcon.DecryptionFailure} title="UTD" />);
        expect(result.asFragment()).toMatchSnapshot();
    });
});
