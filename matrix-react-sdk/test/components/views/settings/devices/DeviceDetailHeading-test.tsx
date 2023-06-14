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

import React from "react";
import { fireEvent, render, RenderResult } from "@testing-library/react";

import { DeviceDetailHeading } from "../../../../../src/components/views/settings/devices/DeviceDetailHeading";
import { flushPromisesWithFakeTimers } from "../../../../test-utils";
import { DeviceType } from "../../../../../src/utils/device/parseUserAgent";

jest.useFakeTimers();

describe("<DeviceDetailHeading />", () => {
    const device = {
        device_id: "123",
        display_name: "My device",
        isVerified: true,
        deviceType: DeviceType.Unknown,
    };
    const defaultProps = {
        device,
        saveDeviceName: jest.fn(),
    };
    const getComponent = (props = {}) => <DeviceDetailHeading {...defaultProps} {...props} />;

    const setInputValue = (getByTestId: RenderResult["getByTestId"], value: string) => {
        const input = getByTestId("device-rename-input");

        fireEvent.change(input, { target: { value } });
    };

    it("renders device name", () => {
        const { container } = render(getComponent());
        expect({ container }).toMatchSnapshot();
    });

    it("renders device id as fallback when device has no display name", () => {
        const { getByText } = render(
            getComponent({
                device: { ...device, display_name: undefined },
            }),
        );
        expect(getByText(device.device_id)).toBeTruthy();
    });

    it("displays name edit form on rename button click", () => {
        const { getByTestId, container } = render(getComponent());

        fireEvent.click(getByTestId("device-heading-rename-cta"));

        expect({ container }).toMatchSnapshot();
    });

    it("cancelling edit switches back to original display", () => {
        const { getByTestId, container } = render(getComponent());

        // start editing
        fireEvent.click(getByTestId("device-heading-rename-cta"));

        // stop editing
        fireEvent.click(getByTestId("device-rename-cancel-cta"));

        expect(container.getElementsByClassName("mx_DeviceDetailHeading").length).toBe(1);
    });

    it("clicking submit updates device name with edited value", () => {
        const saveDeviceName = jest.fn();
        const { getByTestId } = render(getComponent({ saveDeviceName }));

        // start editing
        fireEvent.click(getByTestId("device-heading-rename-cta"));

        setInputValue(getByTestId, "new device name");

        fireEvent.click(getByTestId("device-rename-submit-cta"));

        expect(saveDeviceName).toHaveBeenCalledWith("new device name");
    });

    it("disables form while device name is saving", () => {
        const { getByTestId, container } = render(getComponent());

        // start editing
        fireEvent.click(getByTestId("device-heading-rename-cta"));

        setInputValue(getByTestId, "new device name");

        fireEvent.click(getByTestId("device-rename-submit-cta"));

        // buttons disabled
        expect(getByTestId("device-rename-cancel-cta").getAttribute("aria-disabled")).toEqual("true");
        expect(getByTestId("device-rename-submit-cta").getAttribute("aria-disabled")).toEqual("true");

        expect(container.getElementsByClassName("mx_Spinner").length).toBeTruthy();
    });

    it("toggles out of editing mode when device name is saved successfully", async () => {
        const { getByTestId } = render(getComponent());

        // start editing
        fireEvent.click(getByTestId("device-heading-rename-cta"));
        setInputValue(getByTestId, "new device name");
        fireEvent.click(getByTestId("device-rename-submit-cta"));

        await flushPromisesWithFakeTimers();

        // read mode displayed
        expect(getByTestId("device-detail-heading")).toBeTruthy();
    });

    it("displays error when device name fails to save", async () => {
        const saveDeviceName = jest.fn().mockRejectedValueOnce("oups").mockResolvedValue({});
        const { getByTestId, queryByText, container } = render(getComponent({ saveDeviceName }));

        // start editing
        fireEvent.click(getByTestId("device-heading-rename-cta"));
        setInputValue(getByTestId, "new device name");
        fireEvent.click(getByTestId("device-rename-submit-cta"));

        // flush promise
        await flushPromisesWithFakeTimers();
        // then tick for render
        await flushPromisesWithFakeTimers();

        // error message displayed
        expect(queryByText("Failed to set display name")).toBeTruthy();
        // spinner removed
        expect(container.getElementsByClassName("mx_Spinner").length).toBeFalsy();

        // try again
        fireEvent.click(getByTestId("device-rename-submit-cta"));

        // error message cleared
        expect(queryByText("Failed to set display name")).toBeFalsy();
    });
});
