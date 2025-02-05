/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, type RenderResult, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked, type Mocked } from "jest-mock";
import { type IMyDevice, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CryptoApi, DeviceVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import dis from "../../../src/dispatcher/dispatcher";
import { showToast } from "../../../src/toasts/UnverifiedSessionToast";
import { filterConsole, flushPromises, stubClient } from "../../test-utils";
import ToastContainer from "../../../src/components/structures/ToastContainer";
import { Action } from "../../../src/dispatcher/actions";
import DeviceListener from "../../../src/DeviceListener";

describe("UnverifiedSessionToast", () => {
    const otherDevice: IMyDevice = {
        device_id: "ABC123",
    };
    let client: Mocked<MatrixClient>;
    let renderResult: RenderResult;

    filterConsole("Dismissing unverified sessions: ABC123");

    beforeAll(() => {
        client = mocked(stubClient());
        client.getDevice.mockImplementation(async (deviceId: string) => {
            if (deviceId === otherDevice.device_id) {
                return otherDevice;
            }

            throw new Error(`Unknown device ${deviceId}`);
        });
        client.getCrypto.mockReturnValue({
            getDeviceVerificationStatus: jest
                .fn()
                .mockResolvedValue(new DeviceVerificationStatus({ crossSigningVerified: true })),
        } as unknown as CryptoApi);
        jest.spyOn(dis, "dispatch");
        jest.spyOn(DeviceListener.sharedInstance(), "dismissUnverifiedSessions");
    });

    beforeEach(() => {
        renderResult = render(<ToastContainer />);
    });

    describe("when rendering the toast", () => {
        beforeEach(async () => {
            showToast(otherDevice.device_id);
            await flushPromises();
        });

        const itShouldDismissTheDevice = () => {
            it("should dismiss the device", () => {
                expect(DeviceListener.sharedInstance().dismissUnverifiedSessions).toHaveBeenCalledWith([
                    otherDevice.device_id,
                ]);
            });
        };

        it("should render as expected", async () => {
            await expect(screen.findByText("New login. Was this you?")).resolves.toBeInTheDocument();
            expect(renderResult.baseElement).toMatchSnapshot();
        });

        describe("and confirming the login", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByRole("button", { name: "Yes, it was me" }));
            });

            itShouldDismissTheDevice();
        });

        describe("and dismissing the login", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByRole("button", { name: "No" }));
            });

            itShouldDismissTheDevice();

            it("should show the device settings", () => {
                expect(dis.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewUserDeviceSettings,
                });
            });
        });
    });
});
