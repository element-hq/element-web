/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";
import { render } from "jest-matrix-react";

import SettingsTab, { type SettingsTabProps } from "../../../../../../src/components/views/settings/tabs/SettingsTab";

describe("<SettingsTab />", () => {
    const getComponent = (props: SettingsTabProps): ReactElement => <SettingsTab {...props} />;
    it("renders tab", () => {
        const { container } = render(getComponent({ children: <div>test</div> }));

        expect(container).toMatchSnapshot();
    });
});
