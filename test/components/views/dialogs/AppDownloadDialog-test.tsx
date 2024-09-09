/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "@testing-library/react";

import { AppDownloadDialog } from "../../../../src/components/views/dialogs/AppDownloadDialog";
import SdkConfig, { ConfigOptions } from "../../../../src/SdkConfig";

describe("AppDownloadDialog", () => {
    afterEach(() => {
        SdkConfig.reset();
    });

    it("should render with desktop, ios, android, fdroid buttons by default", () => {
        const { asFragment } = render(<AppDownloadDialog onFinished={jest.fn()} />);
        expect(screen.queryByRole("button", { name: "Download Element Desktop" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Download on the App Store" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Get it on Google Play" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Get it on F-Droid" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should allow disabling fdroid build", () => {
        SdkConfig.add({
            mobile_builds: {
                fdroid: null,
            },
        } as ConfigOptions);
        const { asFragment } = render(<AppDownloadDialog onFinished={jest.fn()} />);
        expect(screen.queryByRole("button", { name: "Download Element Desktop" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Download on the App Store" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Get it on Google Play" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Get it on F-Droid" })).not.toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should allow disabling desktop build", () => {
        SdkConfig.add({
            desktop_builds: {
                available: false,
            },
        } as ConfigOptions);
        const { asFragment } = render(<AppDownloadDialog onFinished={jest.fn()} />);
        expect(screen.queryByRole("button", { name: "Download Element Desktop" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Download on the App Store" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Get it on Google Play" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Get it on F-Droid" })).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should allow disabling mobile builds", () => {
        SdkConfig.add({
            mobile_builds: {
                ios: null,
                android: null,
                fdroid: null,
            },
        } as ConfigOptions);
        const { asFragment } = render(<AppDownloadDialog onFinished={jest.fn()} />);
        expect(screen.queryByRole("button", { name: "Download Element Desktop" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Download on the App Store" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Get it on Google Play" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Get it on F-Droid" })).not.toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });
});
