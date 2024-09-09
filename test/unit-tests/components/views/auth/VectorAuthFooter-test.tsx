/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import * as React from "react";
import { render } from "@testing-library/react";

import VectorAuthFooter from "../../../../../src/components/views/auth/VectorAuthFooter";
import { setupLanguageMock } from "../../../../setup/setupLanguage";

describe("<VectorAuthFooter />", () => {
    beforeEach(() => {
        setupLanguageMock();
    });

    it("should match snapshot", () => {
        const { asFragment } = render(<VectorAuthFooter />);
        expect(asFragment()).toMatchSnapshot();
    });
});
