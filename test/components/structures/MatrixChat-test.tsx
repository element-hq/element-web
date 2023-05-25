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

import React, { ComponentProps } from "react";
import { render, RenderResult, screen } from "@testing-library/react";
import fetchMockJest from "fetch-mock-jest";
import { ClientEvent } from "matrix-js-sdk/src/client";
import { SyncState } from "matrix-js-sdk/src/sync";
import { MediaHandler } from "matrix-js-sdk/src/webrtc/mediaHandler";

import MatrixChat from "../../../src/components/structures/MatrixChat";
import * as StorageManager from "../../../src/utils/StorageManager";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { UserTab } from "../../../src/components/views/dialogs/UserTab";
import { flushPromises, getMockClientWithEventEmitter, mockClientMethodsUser } from "../../test-utils";

describe("<MatrixChat />", () => {
    const userId = "@alice:server.org";
    const deviceId = "qwertyui";
    const accessToken = "abc123";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        startClient: jest.fn(),
        stopClient: jest.fn(),
        setCanResetTimelineCallback: jest.fn(),
        isInitialSyncComplete: jest.fn(),
        getSyncState: jest.fn(),
        getSyncStateData: jest.fn().mockReturnValue(null),
        getThirdpartyProtocols: jest.fn().mockResolvedValue({}),
        getClientWellKnown: jest.fn().mockReturnValue({}),
        isVersionSupported: jest.fn().mockResolvedValue(false),
        isCryptoEnabled: jest.fn().mockReturnValue(false),
        getRoom: jest.fn(),
        getMediaHandler: jest.fn().mockReturnValue({
            setVideoInput: jest.fn(),
            setAudioInput: jest.fn(),
            setAudioSettings: jest.fn(),
            stopAllStreams: jest.fn(),
        } as unknown as MediaHandler),
        setAccountData: jest.fn(),
        store: {
            destroy: jest.fn(),
        },
    });
    const serverConfig = {
        hsUrl: "https://test.com",
        hsName: "Test Server",
        hsNameIsDifferent: false,
        isUrl: "https://is.com",
        isDefault: true,
        isNameResolvable: true,
        warning: "",
    };
    const defaultProps: ComponentProps<typeof MatrixChat> = {
        config: {
            brand: "Test",
            element_call: {},
            feedback: {
                existing_issues_url: "https://feedback.org/existing",
                new_issue_url: "https://feedback.org/new",
            },
            validated_server_config: serverConfig,
        },
        onNewScreen: jest.fn(),
        onTokenLoginCompleted: jest.fn(),
        makeRegistrationUrl: jest.fn(),
        realQueryParams: {},
    };
    const getComponent = (props: Partial<ComponentProps<typeof MatrixChat>> = {}) =>
        render(<MatrixChat {...defaultProps} {...props} />);
    const localStorageSpy = jest.spyOn(localStorage.__proto__, "getItem").mockReturnValue(undefined);

    beforeEach(() => {
        fetchMockJest.get("https://test.com/_matrix/client/versions", {
            unstable_features: {},
            versions: [],
        });
        localStorageSpy.mockClear();
        jest.spyOn(StorageManager, "idbLoad").mockRestore();
        jest.spyOn(StorageManager, "idbSave").mockResolvedValue(undefined);
        jest.spyOn(defaultDispatcher, "dispatch").mockClear();
    });

    it("should render spinner while app is loading", () => {
        const { container } = getComponent();

        expect(container).toMatchSnapshot();
    });

    describe("with an existing session", () => {
        const mockidb: Record<string, Record<string, string>> = {
            acccount: {
                mx_access_token: accessToken,
            },
        };
        const mockLocalStorage: Record<string, string> = {
            mx_hs_url: serverConfig.hsUrl,
            mx_is_url: serverConfig.isUrl,
            mx_access_token: accessToken,
            mx_user_id: userId,
            mx_device_id: deviceId,
        };

        beforeEach(() => {
            localStorageSpy.mockImplementation((key: unknown) => mockLocalStorage[key as string] || "");

            jest.spyOn(StorageManager, "idbLoad").mockImplementation(async (table, key) => {
                const safeKey = Array.isArray(key) ? key[0] : key;
                return mockidb[table]?.[safeKey];
            });
        });

        const getComponentAndWaitForReady = async (): Promise<RenderResult> => {
            const renderResult = getComponent();
            // we think we are logged in, but are still waiting for the /sync to complete
            await screen.findByText("Logout");
            // initial sync
            mockClient.emit(ClientEvent.Sync, SyncState.Prepared, null);
            // wait for logged in view to load
            await screen.findByLabelText("User menu");
            // let things settle
            await flushPromises();
            // and some more for good measure
            // this proved to be a little flaky
            await flushPromises();

            return renderResult;
        };

        it("should render welcome page after login", async () => {
            getComponent();

            // we think we are logged in, but are still waiting for the /sync to complete
            const logoutButton = await screen.findByText("Logout");

            expect(logoutButton).toBeInTheDocument();
            expect(screen.getByRole("progressbar")).toBeInTheDocument();

            // initial sync
            mockClient.emit(ClientEvent.Sync, SyncState.Prepared, null);

            // wait for logged in view to load
            await screen.findByLabelText("User menu");
            // let things settle
            await flushPromises();
            expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
            expect(screen.getByText(`Welcome ${userId}`)).toBeInTheDocument();
        });

        describe("onAction()", () => {
            it("should open user device settings", async () => {
                await getComponentAndWaitForReady();

                defaultDispatcher.dispatch({
                    action: Action.ViewUserDeviceSettings,
                });

                await flushPromises();

                expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Security,
                });
            });
        });
    });
});
