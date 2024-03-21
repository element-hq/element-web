/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { act, render, RenderResult } from "@testing-library/react";
import React, { ComponentProps } from "react";
import EventEmitter from "events";
import { CryptoEvent } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";

import { LoginSplashView } from "../../../../src/components/structures/auth/LoginSplashView";
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
