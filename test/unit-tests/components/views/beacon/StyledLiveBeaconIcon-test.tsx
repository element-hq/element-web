/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import StyledLiveBeaconIcon from "../../../../../src/components/views/beacon/StyledLiveBeaconIcon";

describe("<StyledLiveBeaconIcon />", () => {
    const defaultProps = {};
    const getComponent = (props = {}) => render(<StyledLiveBeaconIcon {...defaultProps} {...props} />);

    it("renders", () => {
        const { asFragment } = getComponent();
        expect(asFragment()).toMatchSnapshot();
    });
});
