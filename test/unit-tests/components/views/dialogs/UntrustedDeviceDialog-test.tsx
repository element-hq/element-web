/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Device, type MatrixClient, User } from "matrix-js-sdk/src/matrix";
import { render, screen } from "jest-matrix-react";

import { stubClient } from "../../../../test-utils";
import UntrustedDeviceDialog from "../../../../../src/components/views/dialogs/UntrustedDeviceDialog.tsx";

describe("<UntrustedDeviceDialog />", () => {
    let client: MatrixClient;
    let user: User;
    let device: Device;
    const onFinished = jest.fn();

    beforeEach(() => {
        client = stubClient();
        user = User.createUser("@alice:example.org", client);
        user.setDisplayName("Alice");
        device = new Device({ deviceId: "device_id", userId: user.userId, algorithms: [], keys: new Map() });
    });

    afterEach(() => {
        onFinished.mockReset();
    });

    function renderComponent() {
        return render(<UntrustedDeviceDialog user={user} device={device} onFinished={onFinished} />);
    }

    it("should display the dialog for the device of another user", () => {
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the dialog for the device of the current user", () => {
        jest.spyOn(client, "getUserId").mockReturnValue(user.userId);

        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should call onFinished without parameter when Done is clicked", () => {
        renderComponent();
        screen.getByRole("button", { name: "Done" }).click();
        expect(onFinished).toHaveBeenCalledWith();
    });

    it("should call onFinished with sas when Interactively verify by emoji is clicked", () => {
        renderComponent();
        screen.getByRole("button", { name: "Interactively verify by emoji" }).click();
        expect(onFinished).toHaveBeenCalledWith("sas");
    });
});
