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
import { mocked } from "jest-mock";

import CrossSigningPanel from "../../../../src/components/views/settings/CrossSigningPanel";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsUser,
} from "../../../test-utils";

describe("<CrossSigningPanel />", () => {
    const userId = "@alice:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsCrypto(),
        doesServerSupportUnstableFeature: jest.fn(),
    });
    const getComponent = () => render(<CrossSigningPanel />);

    beforeEach(() => {
        mockClient.doesServerSupportUnstableFeature.mockResolvedValue(true);
        mockClient.isCrossSigningReady.mockResolvedValue(false);
        mocked(mockClient.crypto!.crossSigningInfo).isStoredInSecretStorage.mockClear().mockResolvedValue(null);
    });

    it("should render a spinner while loading", () => {
        getComponent();

        expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("should render when homeserver does not support cross-signing", async () => {
        mockClient.doesServerSupportUnstableFeature.mockResolvedValue(false);

        getComponent();
        await flushPromises();

        expect(screen.getByText("Your homeserver does not support cross-signing.")).toBeInTheDocument();
    });

    describe("when cross signing is ready", () => {
        beforeEach(() => {
            mockClient.isCrossSigningReady.mockResolvedValue(true);
        });

        it("should render when keys are not backed up", async () => {
            getComponent();
            await flushPromises();

            expect(screen.getByTestId("summarised-status").innerHTML).toEqual(
                "⚠️ Cross-signing is ready but keys are not backed up.",
            );
            expect(screen.getByText("Cross-signing private keys:").parentElement!).toMatchSnapshot();
        });

        it("should render when keys are backed up", async () => {
            mocked(mockClient.crypto!.crossSigningInfo).isStoredInSecretStorage.mockResolvedValue({ test: {} });
            getComponent();
            await flushPromises();

            expect(screen.getByTestId("summarised-status").innerHTML).toEqual("✅ Cross-signing is ready for use.");
            expect(screen.getByText("Cross-signing private keys:").parentElement!).toMatchSnapshot();
            expect(mockClient.crypto!.crossSigningInfo.isStoredInSecretStorage).toHaveBeenCalledWith(
                mockClient.secretStorage,
            );
        });
    });

    describe("when cross signing is not ready", () => {
        beforeEach(() => {
            mockClient.isCrossSigningReady.mockResolvedValue(false);
        });

        it("should render when keys are not backed up", async () => {
            getComponent();
            await flushPromises();

            expect(screen.getByTestId("summarised-status").innerHTML).toEqual("Cross-signing is not set up.");
        });

        it("should render when keys are backed up", async () => {
            mocked(mockClient.crypto!.crossSigningInfo).isStoredInSecretStorage.mockResolvedValue({ test: {} });
            getComponent();
            await flushPromises();

            expect(screen.getByTestId("summarised-status").innerHTML).toEqual(
                "Your account has a cross-signing identity in secret storage, but it is not yet trusted by this session.",
            );
            expect(screen.getByText("Cross-signing private keys:").parentElement!).toMatchSnapshot();
            expect(mockClient.crypto!.crossSigningInfo.isStoredInSecretStorage).toHaveBeenCalledWith(
                mockClient.secretStorage,
            );
        });
    });
});
