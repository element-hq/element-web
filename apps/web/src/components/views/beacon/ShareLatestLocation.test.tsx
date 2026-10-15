/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render } from "test-utils-rtl";
import { flushPromises } from "test-utils";
import { copyPlainTextToClipboard } from "@element-hq/element-web-shared-utils";

import ShareLatestLocation from "./ShareLatestLocation";

vi.mock("@element-hq/element-web-shared-utils", async () => ({
    ...(await vi.importActual("@element-hq/element-web-shared-utils")),
    copyPlainTextToClipboard: vi.fn().mockResolvedValue(undefined),
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
        vi.clearAllMocks();
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

        expect(copyPlainTextToClipboard).toHaveBeenCalledWith("51,42");
    });
});
