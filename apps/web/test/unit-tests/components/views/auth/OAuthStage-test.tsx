/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, type RenderResult } from "jest-matrix-react";

import InteractiveAuthComponent from "../../../../../src/components/structures/InteractiveAuth";
import { getMockClientWithEventEmitter, unmockClientPeg } from "../../../../test-utils";

describe("InteractiveAuthComponent", function () {
    const mockClient = getMockClientWithEventEmitter({
        generateClientSecret: jest.fn().mockReturnValue("t35tcl1Ent5ECr3T"),
        getDomain: jest.fn().mockReturnValue("test.local"),
    });
    const authUrl = "https://test.local/oauth?action=foo";
    const onAuthFinished = jest.fn();
    const makeRequest = jest.fn().mockResolvedValue({ a: 1 });

    const defaultProps = {
        matrixClient: mockClient,
        makeRequest: jest.fn().mockResolvedValue(undefined),
        onAuthFinished: jest.fn(),
    };
    const getComponent = (props = {}) => render(<InteractiveAuthComponent {...defaultProps} {...props} />);

    beforeEach(function () {
        jest.clearAllMocks();
        jest.spyOn(global.window, "open").mockImplementation();
    });

    afterAll(() => {
        unmockClientPeg();
    });

    const getSubmitButton = ({ container }: RenderResult) => container.querySelector(".mx_Dialog_nonDialogButton");

    it("should use an m.oauth stage", async () => {
        const authData = {
            session: "sess",
            flows: [{ stages: ["m.oauth"] }],
            params: {
                "m.oauth": {
                    url: authUrl,
                },
            },
        };

        const wrapper = getComponent({ makeRequest, onAuthFinished, authData });

        const submitNode = getSubmitButton(wrapper);
        expect(submitNode).toBeTruthy();

        // click button; should trigger the auth URL to be opened
        fireEvent.click(submitNode!);

        expect(global.window.open).toHaveBeenCalledWith(authUrl, "_blank");
    });

    it("should use an unstable org.matrix.cross_signing_reset stage", async () => {
        const authData = {
            session: "sess",
            flows: [{ stages: ["org.matrix.cross_signing_reset"] }],
            params: {
                "org.matrix.cross_signing_reset": {
                    url: authUrl,
                },
            },
        };

        const wrapper = getComponent({ makeRequest, onAuthFinished, authData });

        const submitNode = getSubmitButton(wrapper);
        expect(submitNode).toBeTruthy();

        // click button; should trigger the auth URL to be opened
        fireEvent.click(submitNode!);

        expect(global.window.open).toHaveBeenCalledWith(authUrl, "_blank");
    });

    it("should use the first flow when both stable and unstable are present", async () => {
        const authData = {
            session: "sess",
            flows: [{ stages: ["org.matrix.cross_signing_reset"] }, { stages: ["m.oauth"] }],
            params: {
                "org.matrix.cross_signing_reset": {
                    url: authUrl,
                },
                "m.oauth": {
                    url: "https://should.not.be/opened",
                },
            },
        };

        const wrapper = getComponent({ makeRequest, onAuthFinished, authData });

        const submitNode = getSubmitButton(wrapper);
        expect(submitNode).toBeTruthy();

        // click button; should trigger the auth URL to be opened
        fireEvent.click(submitNode!);

        expect(global.window.open).toHaveBeenCalledWith(authUrl, "_blank");
    });
});
