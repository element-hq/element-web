/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import * as React from "react";
import { render } from "jest-matrix-react";

import AuthPage from "../../../../../src/components/views/auth/AuthPage";
import { setupLanguageMock } from "../../../../setup/setupLanguage";

describe("<AuthPage />", () => {
    beforeEach(() => {
        setupLanguageMock();
    });

    it("should match snapshot", () => {
        const { asFragment } = render(<AuthPage />);
        expect(asFragment()).toMatchSnapshot();
    });
});
