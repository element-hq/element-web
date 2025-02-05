/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, render, type RenderResult } from "jest-matrix-react";
import React, { type ComponentProps } from "react";
import EventEmitter from "events";
import { CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { sleep } from "matrix-js-sdk/src/utils";

import { LoginSplashView } from "../../../../../src/components/structures/auth/LoginSplashView";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

describe("<LoginSplashView />", () => {
    let matrixClient: MatrixClient;
    beforeEach(() => {
        matrixClient = new EventEmitter() as unknown as MatrixClient;
    });

    function getComponent(props: Partial<ComponentProps<typeof LoginSplashView>> = {}): RenderResult {
        const defaultProps = {
            matrixClient,
            onLogoutClick: () => {},
            syncError: null,
        };
        return render(<LoginSplashView {...defaultProps} {...props} />);
    }

    it("Renders a spinner", () => {
        const rendered = getComponent();
        expect(rendered.getByTestId("spinner")).toBeInTheDocument();
        expect(rendered.asFragment()).toMatchSnapshot();
    });

    it("Renders an error message", () => {
        const rendered = getComponent({ syncError: new Error("boohoo") });
        expect(rendered.asFragment()).toMatchSnapshot();
    });

    it("Calls onLogoutClick", () => {
        const onLogoutClick = jest.fn();
        const rendered = getComponent({ onLogoutClick });
        expect(onLogoutClick).not.toHaveBeenCalled();
        rendered.getByRole("button", { name: "Logout" }).click();
        expect(onLogoutClick).toHaveBeenCalled();
    });

    it("Shows migration progress", async () => {
        const rendered = getComponent();

        act(() => {
            matrixClient.emit(CryptoEvent.LegacyCryptoStoreMigrationProgress, 5, 10);
        });
        rendered.getByText("Hang tight.", { exact: false });

        // Wait for the animation to update
        await act(() => sleep(500));

        const progress = rendered.getByRole("progressbar");
        expect(progress.getAttribute("value")).toEqual("5");
        expect(progress.getAttribute("max")).toEqual("10");
    });
});
