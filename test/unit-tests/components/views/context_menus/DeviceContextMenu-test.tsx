/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import { clearAllModals } from "../../../../test-utils";
import DeviceContextMenu from "../../../../../src/components/views/context_menus/DeviceContextMenu.tsx";
import MediaDeviceHandler from "../../../../../src/MediaDeviceHandler.ts";

describe("DeviceContextMenu", () => {
    afterEach(async () => {
        await clearAllModals();
    });

    it("renders a menu with the selected device checked", async () => {
        jest.spyOn(MediaDeviceHandler, "getDevices").mockResolvedValue({
            videoinput: [
                { deviceId: "A", label: "Camera 1" } as MediaDeviceInfo,
                { deviceId: "B", label: "Camera 2" } as MediaDeviceInfo,
                { deviceId: "C", label: "Camera 3" } as MediaDeviceInfo,
            ],
            audioinput: [],
            audiooutput: [],
        });
        jest.spyOn(MediaDeviceHandler, "getDevice").mockReturnValue("B");

        const { container, findByLabelText } = render(
            <DeviceContextMenu deviceKinds={["videoinput"]} onFinished={jest.fn()} mountAsChild />,
        );

        await expect(findByLabelText("Camera 2")).resolves.toBeChecked();
        expect(container).toMatchSnapshot();
    });
});
