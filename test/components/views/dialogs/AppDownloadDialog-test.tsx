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
