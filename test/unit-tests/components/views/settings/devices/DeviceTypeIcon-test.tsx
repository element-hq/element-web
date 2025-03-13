/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import { DeviceTypeIcon } from "../../../../../../src/components/views/settings/devices/DeviceTypeIcon";
import { DeviceType } from "../../../../../../src/utils/device/parseUserAgent";

describe("<DeviceTypeIcon />", () => {
    const defaultProps = {
        isVerified: false,
        isSelected: false,
    };
    const getComponent = (props = {}) => <DeviceTypeIcon {...defaultProps} {...props} />;

    it("renders an unverified device", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders a verified device", () => {
        const { container } = render(getComponent({ isVerified: true }));
        expect(container).toMatchSnapshot();
    });

    it("renders correctly when selected", () => {
        const { container } = render(getComponent({ isSelected: true }));
        expect(container).toMatchSnapshot();
    });

    it("renders an unknown device icon when no device type given", () => {
        const { getByLabelText } = render(getComponent());
        expect(getByLabelText("Unknown session type")).toBeTruthy();
    });

    it("renders a desktop device type", () => {
        const deviceType = DeviceType.Desktop;
        const { getByLabelText } = render(getComponent({ deviceType }));
        expect(getByLabelText("Desktop session")).toBeTruthy();
    });

    it("renders a web device type", () => {
        const deviceType = DeviceType.Web;
        const { getByLabelText } = render(getComponent({ deviceType }));
        expect(getByLabelText("Web session")).toBeTruthy();
    });

    it("renders a mobile device type", () => {
        const deviceType = DeviceType.Mobile;
        const { getByLabelText } = render(getComponent({ deviceType }));
        expect(getByLabelText("Mobile session")).toBeTruthy();
    });

    it("renders an unknown device type", () => {
        const deviceType = DeviceType.Unknown;
        const { getByLabelText } = render(getComponent({ deviceType }));
        expect(getByLabelText("Unknown session type")).toBeTruthy();
    });
});
