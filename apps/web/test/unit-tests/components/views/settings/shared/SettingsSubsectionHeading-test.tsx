/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import { SettingsSubsectionHeading } from "../../../../../../src/components/views/settings/shared/SettingsSubsectionHeading";

describe("<SettingsSubsectionHeading />", () => {
    const defaultProps = {
        children: "test",
    };
    const getComponent = (props = {}) => render(<SettingsSubsectionHeading {...defaultProps} {...props} />);

    it("renders without contextMenu", () => {
        const { container } = getComponent();
        expect({ container }).toMatchSnapshot();
    });

    it("renders with contextMenu", () => {
        const contextMenu = <a href="/#">test</a>;
        const { container } = getComponent({ contextMenu });
        expect({ container }).toMatchSnapshot();
    });
});
