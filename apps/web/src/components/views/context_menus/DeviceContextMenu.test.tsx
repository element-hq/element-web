/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { render } from "test-utils-rtl";
import React from "react";
import { describe, it, afterEach, expect, vi } from "vitest";
import { clearAllModals } from "test-utils";

import DeviceContextMenu from "./DeviceContextMenu.tsx";
import MediaDeviceHandler from "../../../MediaDeviceHandler.ts";

describe("DeviceContextMenu", () => {
    afterEach(async () => {
        await clearAllModals();
    });

    it("renders a menu with the selected device checked", async () => {
        vi.spyOn(MediaDeviceHandler, "getDevices").mockResolvedValue({
            videoinput: [
                { deviceId: "A", label: "Camera 1" } as MediaDeviceInfo,
                { deviceId: "B", label: "Camera 2" } as MediaDeviceInfo,
                { deviceId: "C", label: "Camera 3" } as MediaDeviceInfo,
            ],
            audioinput: [],
            audiooutput: [],
        });
        vi.spyOn(MediaDeviceHandler, "getDevice").mockReturnValue("B");

        const { container, findByLabelText } = render(
            <DeviceContextMenu deviceKinds={["videoinput"]} onFinished={vi.fn()} mountAsChild />,
        );

        await expect(findByLabelText("Camera 2")).resolves.toBeChecked();
        expect(container).toMatchSnapshot();
    });
});
