/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React, { ComponentProps } from "react";
import { Mocked } from "jest-mock";
import { act, render, RenderResult } from "@testing-library/react";
import {
    VerificationRequest,
    VerificationRequestEvent,
} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { DeviceInfo } from "matrix-js-sdk/src/crypto/deviceinfo";
import { IMyDevice, MatrixClient } from "matrix-js-sdk/src/client";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import VerificationRequestToast from "../../../../src/components/views/toasts/VerificationRequestToast";
import { flushPromises, getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../test-utils";

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
            getStoredDevice: jest.fn(),
            getDevice: jest.fn(),
        });
    });

    it("should render a self-verification", async () => {
        const otherDeviceId = "other_device";
        const otherIDevice: IMyDevice = { device_id: otherDeviceId, last_seen_ip: "1.1.1.1" };
        client.getDevice.mockResolvedValue(otherIDevice);

        const otherDeviceInfo = new DeviceInfo(otherDeviceId);
        otherDeviceInfo.unsigned = { device_display_name: "my other device" };
        client.getStoredDevice.mockReturnValue(otherDeviceInfo);

        const request = makeMockVerificationRequest({
            isSelfVerification: true,
            otherDeviceId,
        });
        const result = renderComponent({ request });
        await act(async () => {
            await flushPromises();
        });
        expect(result.container).toMatchSnapshot();
    });

    it("should render a cross-user verification", async () => {
        const otherUserId = "@other:user";
        const request = makeMockVerificationRequest({
            isSelfVerification: false,
            otherUserId,
        });
        const result = renderComponent({ request });
        await act(async () => {
            await flushPromises();
        });
        expect(result.container).toMatchSnapshot();
    });
});

function makeMockVerificationRequest(props: Partial<VerificationRequest> = {}): Mocked<VerificationRequest> {
    const request = new TypedEventEmitter<VerificationRequestEvent, any>();
    Object.assign(request, {
        ...props,
    });
    return request as unknown as Mocked<VerificationRequest>;
}
