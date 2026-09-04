/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2022 Callum Brown
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { fireEvent, render, type RenderResult } from "test-utils-rtl";
import { flushPromises, getMockClientWithEventEmitter, unmockClientPeg } from "test-utils";

import InteractiveAuthComponent from "./InteractiveAuth";

describe("InteractiveAuthComponent", function () {
    const mockClient = getMockClientWithEventEmitter({
        generateClientSecret: vi.fn().mockReturnValue("t35tcl1Ent5ECr3T"),
    });

    const defaultProps = {
        matrixClient: mockClient,
        makeRequest: vi.fn().mockResolvedValue(undefined),
        onAuthFinished: vi.fn(),
    };
    const getComponent = (props = {}) => render(<InteractiveAuthComponent {...defaultProps} {...props} />);

    beforeEach(function () {
        vi.clearAllMocks();
    });

    afterAll(() => {
        unmockClientPeg();
    });

    const getSubmitButton = ({ container }: RenderResult) =>
        container.querySelector(".mx_AccessibleButton_kind_primary");
    const getRegistrationTokenInput = ({ container }: RenderResult) =>
        container.querySelector('input[name="registrationTokenField"]');

    it("Should successfully complete a registration token flow", async () => {
        const onAuthFinished = vi.fn();
        const makeRequest = vi.fn().mockResolvedValue({ a: 1 });

        const authData = {
            session: "sess",
            flows: [{ stages: ["m.login.registration_token"] }],
        };

        const wrapper = getComponent({ makeRequest, onAuthFinished, authData });

        const registrationTokenNode = getRegistrationTokenInput(wrapper);
        const submitNode = getSubmitButton(wrapper);
        const formNode = wrapper.container.querySelector("form");

        expect(registrationTokenNode).toBeTruthy();
        expect(submitNode).toBeTruthy();
        expect(formNode).toBeTruthy();

        // submit should be disabled
        expect(submitNode).toHaveAttribute("disabled");
        expect(submitNode).toHaveAttribute("aria-disabled", "true");

        // put something in the registration token box
        fireEvent.change(registrationTokenNode!, { target: { value: "s3kr3t" } });

        expect(getRegistrationTokenInput(wrapper)).toHaveValue("s3kr3t");
        expect(submitNode).not.toHaveAttribute("disabled");
        expect(submitNode).not.toHaveAttribute("aria-disabled", "true");

        // hit enter; that should trigger a request
        fireEvent.submit(formNode!);

        // wait for auth request to resolve
        await flushPromises();

        expect(makeRequest).toHaveBeenCalledTimes(1);
        expect(makeRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                session: "sess",
                type: "m.login.registration_token",
                token: "s3kr3t",
            }),
        );

        expect(onAuthFinished).toHaveBeenCalledTimes(1);
        expect(onAuthFinished).toHaveBeenCalledWith(
            true,
            { a: 1 },
            { clientSecret: "t35tcl1Ent5ECr3T", emailSid: undefined },
        );
    });
});
