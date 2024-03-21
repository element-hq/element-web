/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { render } from "@testing-library/react";
import React from "react";

import { DeviceTypeIcon } from "../../../../../src/components/views/settings/devices/DeviceTypeIcon";
import { DeviceType } from "../../../../../src/utils/device/parseUserAgent";

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
