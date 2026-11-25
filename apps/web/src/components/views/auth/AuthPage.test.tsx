/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "test-utils-rtl";

import AuthPage from "./AuthPage";
import SdkConfig from "../../../SdkConfig.ts";

describe("<AuthPage />", () => {
    beforeEach(() => {
        SdkConfig.reset();
        // @ts-ignore private access
        AuthPage.welcomeBackgroundUrl = undefined;
    });

    it("should match snapshot", () => {
        const { asFragment } = render(<AuthPage />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should use configured background url", () => {
        SdkConfig.add({ branding: { welcome_background_url: ["https://example.com/image.png"] } });
        const { container } = render(<AuthPage />);
        expect(container.querySelector(".mx_AuthPage")).toHaveStyle({
            background: "center/cover fixed url(https://example.com/image.png)",
        });
    });
});
