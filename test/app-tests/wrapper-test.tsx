/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import fetchMock from "fetch-mock-jest";
import { render, type RenderResult, screen } from "jest-matrix-react";
import { WrapperLifecycle, type WrapperOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/WrapperLifecycle";

import SdkConfig from "../../src/SdkConfig";
import PlatformPeg from "../../src/PlatformPeg";
import { ModuleRunner } from "../../src/modules/ModuleRunner";
import MatrixChat from "../../src/components/structures/MatrixChat";
import WebPlatform from "../../src/vector/platform/WebPlatform";
import { loadApp } from "../../src/vector/app";
import { waitForLoadingSpinner, waitForWelcomeComponent } from "../test-utils";

/** The matrix versions our mock server claims to support */
const SERVER_SUPPORTED_MATRIX_VERSIONS = ["v1.1", "v1.5", "v1.6", "v1.8", "v1.9"];

fetchMock.config.overwriteRoutes = true;

describe("Wrapper", () => {
    beforeEach(async () => {
        SdkConfig.reset();
        PlatformPeg.set(new WebPlatform());
        fetchMock.get("https://matrix-client.matrix.org/_matrix/client/versions", {
            unstable_features: {},
            versions: SERVER_SUPPORTED_MATRIX_VERSIONS,
        });
        fetchMock.get("https://matrix.org/.well-known/matrix/client", {
            "m.homeserver": {
                base_url: "https://matrix-client.matrix.org",
            },
        });
        fetchMock.get("/version", "1.10.13");
    });

    it("wrap a matrix chat with header and footer", async () => {
        SdkConfig.put({
            default_server_config: {
                "m.homeserver": {
                    base_url: "https://matrix-client.matrix.org",
                },
            },
        });

        jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts) => {
            if (lifecycleEvent === WrapperLifecycle.Wrapper) {
                (opts as WrapperOpts).Wrapper = ({ children }) => {
                    return (
                        <>
                            <div data-testid="wrapper-header">Header</div>
                            <div data-testid="wrapper-matrix-chat">{children}</div>
                            <div data-testid="wrapper-footer">Footer</div>
                        </>
                    );
                };
            }
        });

        const ref = React.createRef<MatrixChat>();
        const matrixChatResult: RenderResult = render(await loadApp({}, ref));

        // at this point, we're trying to do a guest registration;
        // we expect a spinner
        await waitForLoadingSpinner();

        await waitForWelcomeComponent(matrixChatResult);

        // Are not semantic elements because Element has a footer already.
        const header = screen.getByTestId("wrapper-header");
        const matrixChat = screen.getByTestId("wrapper-matrix-chat");
        const footer = screen.getByTestId("wrapper-footer");

        expect(header.nextSibling).toBe(matrixChat);
        expect(matrixChat.nextSibling).toBe(footer);

        // Should still hold a reference to the MatrixChat component
        expect(ref.current).toBeInstanceOf(MatrixChat);
    });
});
