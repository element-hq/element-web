/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render } from "jest-matrix-react";

import ShareLatestLocation from "../../../../../src/components/views/beacon/ShareLatestLocation";
import { copyPlaintext } from "../../../../../src/utils/strings";
import { flushPromises } from "../../../../test-utils";

jest.mock("../../../../../src/utils/strings", () => ({
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
