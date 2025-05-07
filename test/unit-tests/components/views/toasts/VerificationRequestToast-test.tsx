/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { mocked, type Mocked } from "jest-mock";
import { render, type RenderResult } from "jest-matrix-react";
import { TypedEventEmitter, type IMyDevice, type MatrixClient, Device } from "matrix-js-sdk/src/matrix";
import { type VerificationRequest, VerificationRequestEvent } from "matrix-js-sdk/src/crypto-api";

import VerificationRequestToast from "../../../../../src/components/views/toasts/VerificationRequestToast";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsUser,
} from "../../../../test-utils";
import ToastStore from "../../../../../src/stores/ToastStore";

function renderComponent(
    props: Partial<ComponentProps<typeof VerificationRequestToast>> & { request: VerificationRequest },
): RenderResult {
    const propsWithDefaults = {
        toastKey: "test",
        ...props,
    };

    return render(<VerificationRequestToast {...propsWithDefaults} />);
}

describe("VerificationRequestToast", () => {
    let client: Mocked<MatrixClient>;

    beforeEach(() => {
        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            ...mockClientMethodsCrypto(),
            getDevice: jest.fn(),
        });
    });

    it("should render a self-verification", async () => {
        const otherDeviceId = "other_device";
        const otherIDevice: IMyDevice = { device_id: otherDeviceId, last_seen_ip: "1.1.1.1" };
        client.getDevice.mockResolvedValue(otherIDevice);

        const otherDeviceInfo = new Device({
            algorithms: [],
            keys: new Map(),
            userId: "",
            deviceId: otherDeviceId,
            displayName: "my other device",
        });
        const deviceMap = new Map([[client.getSafeUserId(), new Map([[otherDeviceId, otherDeviceInfo]])]]);
        mocked(client.getCrypto()!.getUserDeviceInfo).mockResolvedValue(deviceMap);

        const request = makeMockVerificationRequest({
            isSelfVerification: true,
            otherDeviceId,
        });
        const result = renderComponent({ request });
        await flushPromises();
        expect(result.container).toMatchSnapshot();
    });

    it("should render a cross-user verification", async () => {
        const otherUserId = "@other:user";
        const request = makeMockVerificationRequest({
            isSelfVerification: false,
            otherUserId,
        });
        const result = renderComponent({ request });
        await flushPromises();
        expect(result.container).toMatchSnapshot();
    });

    it("dismisses itself once the request can no longer be accepted", async () => {
        const otherUserId = "@other:user";
        const request = makeMockVerificationRequest({
            isSelfVerification: false,
            otherUserId,
        });
        renderComponent({ request, toastKey: "testKey" });
        await flushPromises();

        const dismiss = jest.spyOn(ToastStore.sharedInstance(), "dismissToast");
        Object.defineProperty(request, "accepting", { value: true });
        request.emit(VerificationRequestEvent.Change);
        expect(dismiss).toHaveBeenCalledWith("testKey");
    });
});

function makeMockVerificationRequest(props: Partial<VerificationRequest> = {}): Mocked<VerificationRequest> {
    const request = new TypedEventEmitter<VerificationRequestEvent, any>();
    Object.assign(request, {
        ...props,
    });
    return request as unknown as Mocked<VerificationRequest>;
}
