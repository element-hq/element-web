/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import SdkConfig from "../../../../src/SdkConfig";
import { ErrorView, UnsupportedBrowserView } from "../../../../src/async-components/structures/ErrorView";
import { setupLanguageMock } from "../../../setup/setupLanguage";

describe("<ErrorView />", () => {
    beforeEach(() => {
        setupLanguageMock();
    });

    it("should match snapshot", () => {
        const { asFragment } = render(<ErrorView title="TITLE" messages={["MSG1", "MSG2"]} />);
        expect(asFragment()).toMatchSnapshot();
    });
});

describe("<UnsupportedBrowserView />", () => {
    beforeEach(() => {
        setupLanguageMock();
        SdkConfig.put({});
    });

    it("should match snapshot", () => {
        const { asFragment } = render(<UnsupportedBrowserView />);
        expect(asFragment()).toMatchSnapshot();
    });
});
