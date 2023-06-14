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
import { fireEvent, render } from "@testing-library/react";

import ShareLatestLocation from "../../../../src/components/views/beacon/ShareLatestLocation";
import { copyPlaintext } from "../../../../src/utils/strings";
import { flushPromises } from "../../../test-utils";

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

jest.mock("../../../../src/utils/strings", () => ({
    copyPlaintext: jest.fn().mockResolvedValue(undefined),
}));

describe("<ShareLatestLocation />", () => {
    const defaultProps = {
        latestLocationState: {
            uri: "geo:51,42;u=35",
            timestamp: 123,
        },
    };
    const getComponent = (props = {}) => render(<ShareLatestLocation {...defaultProps} {...props} />);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders null when no location", () => {
        const { container } = getComponent({ latestLocationState: undefined });
        expect(container.innerHTML).toBeFalsy();
    });

    it("renders share buttons when there is a location", async () => {
        const { container, asFragment } = getComponent();
        expect(asFragment()).toMatchSnapshot();

        fireEvent.click(container.querySelector(".mx_CopyableText_copyButton")!);
        await flushPromises();

        expect(copyPlaintext).toHaveBeenCalledWith("51,42");
    });
});
