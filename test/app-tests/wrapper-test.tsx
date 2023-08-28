/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

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
import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import PlatformPeg from "matrix-react-sdk/src/PlatformPeg";
import fetchMock from "fetch-mock-jest";
import { render, RenderResult, screen } from "@testing-library/react";
import { ModuleRunner } from "matrix-react-sdk/src/modules/ModuleRunner";
import { WrapperLifecycle, WrapperOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/WrapperLifecycle";

import WebPlatform from "../../src/vector/platform/WebPlatform";
import { loadApp } from "../../src/vector/app";
import { waitForLoadingSpinner, waitForWelcomeComponent } from "../test-utils";

fetchMock.config.overwriteRoutes = true;

describe("Wrapper", () => {
    beforeEach(async () => {
        SdkConfig.reset();
        PlatformPeg.set(new WebPlatform());
        fetchMock.get("https://matrix-client.matrix.org/_matrix/client/versions", {
            unstable_features: {},
            versions: ["v1.1"],
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

        const matrixChatResult: RenderResult = render(await loadApp({}));

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
    });
});
