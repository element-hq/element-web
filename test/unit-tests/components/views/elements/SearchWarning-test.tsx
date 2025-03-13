/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import React from "react";

import SdkConfig from "../../../../../src/SdkConfig";
import SearchWarning, { WarningKind } from "../../../../../src/components/views/elements/SearchWarning";

describe("<SearchWarning />", () => {
    describe("with desktop builds available", () => {
        beforeEach(() => {
            SdkConfig.put({
                brand: "Element",
                desktop_builds: {
                    available: true,
                    logo: "https://logo",
                    url: "https://url",
                },
            });
        });

        it("renders with a logo by default", () => {
            const { asFragment, getByRole } = render(
                <SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} />,
            );
            expect(getByRole("presentation")).toHaveAttribute("src", "https://logo");
            expect(asFragment()).toMatchSnapshot();
        });

        it("renders without a logo when showLogo=false", () => {
            const { asFragment, queryByRole } = render(
                <SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} showLogo={false} />,
            );

            expect(queryByRole("img")).not.toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();
        });
    });
});
