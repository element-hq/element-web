/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import AppearanceUserSettingsTab from "../../../../../../../src/components/views/settings/tabs/user/AppearanceUserSettingsTab";
import { withClientContextRenderOptions, stubClient } from "../../../../../../test-utils";

describe("AppearanceUserSettingsTab", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = stubClient();
    });

    it("should render", () => {
        const { asFragment } = render(<AppearanceUserSettingsTab />, withClientContextRenderOptions(client));
        expect(asFragment()).toMatchSnapshot();
    });
});
