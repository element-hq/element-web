/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import DeviceSecurityCard from "../../../../../../src/components/views/settings/devices/DeviceSecurityCard";
import { DeviceSecurityVariation } from "../../../../../../src/components/views/settings/devices/types";

describe("<DeviceSecurityCard />", () => {
    const defaultProps = {
        variation: DeviceSecurityVariation.Verified,
        heading: "Verified session",
        description: "nice",
    };
    const getComponent = (props = {}): React.ReactElement => <DeviceSecurityCard {...defaultProps} {...props} />;

    it("renders basic card", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders with children", () => {
        const { container } = render(
            getComponent({
                children: <div>hey</div>,
                variation: DeviceSecurityVariation.Unverified,
            }),
        );
        expect(container).toMatchSnapshot();
    });
});
