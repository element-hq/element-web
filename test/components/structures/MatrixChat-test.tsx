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
import { fireEvent, render, RenderResult, screen, within } from "@testing-library/react";
import fetchMockJest from "fetch-mock-jest";
import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/client";
import { SyncState } from "matrix-js-sdk/src/sync";
import { MediaHandler } from "matrix-js-sdk/src/webrtc/mediaHandler";
import * as MatrixJs from "matrix-js-sdk/src/matrix";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import MatrixChat from "../../../src/components/structures/MatrixChat";
import * as StorageManager from "../../../src/utils/StorageManager";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { UserTab } from "../../../src/components/views/dialogs/UserTab";
import {
    clearAllModals,
    filterConsole,
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
} from "../../test-utils";
import * as leaveRoomUtils from "../../../src/utils/leave-behaviour";

describe("<MatrixChat />", () => {
    const userId = "@alice:server.org";
    const deviceId = "qwertyui";
    const accessToken = "abc123";
    // reused in createClient mock below
    const getMockClientMethods = () => ({
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
        login: jest.fn(),
        loginFlows: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        clearStores: jest.fn(),
        setGuest: jest.fn(),
        setNotifTimelineSet: jest.fn(),
        getAccountData: jest.fn(),
        doesServerSupportUnstableFeature: jest.fn(),
        getDevices: jest.fn().mockResolvedValue({ devices: [] }),
        getProfileInfo: jest.fn(),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        getRooms: jest.fn().mockReturnValue([]),
        userHasCrossSigningKeys: jest.fn(),
        setGlobalBlacklistUnverifiedDevices: jest.fn(),
        setGlobalErrorOnUnknownDevices: jest.fn(),
        getCrypto: jest.fn(),
        secretStorage: {
            isStored: jest.fn().mockReturnValue(null),
        },
        getDehydratedDevice: jest.fn(),
    });
    let mockClient = getMockClientWithEventEmitter(getMockClientMethods());
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
            help_url: "help_url",
            help_encryption_url: "help_encryption_url",
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

    beforeEach(async () => {
        mockClient = getMockClientWithEventEmitter(getMockClientMethods());
        fetchMockJest.get("https://test.com/_matrix/client/versions", {
            unstable_features: {},
            versions: [],
        });
        localStorageSpy.mockReset();
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
                    initialTabId: UserTab.SessionManager,
                });
            });

            describe("room actions", () => {
                const roomId = "!room:server.org";
                const spaceId = "!spaceRoom:server.org";
                const room = new Room(roomId, mockClient, userId);
                const spaceRoom = new Room(spaceId, mockClient, userId);
                jest.spyOn(spaceRoom, "isSpaceRoom").mockReturnValue(true);

                beforeEach(() => {
                    mockClient.getRoom.mockImplementation(
                        (id) => [room, spaceRoom].find((room) => room.roomId === id) || null,
                    );
                    jest.spyOn(defaultDispatcher, "dispatch").mockClear();
                });

                describe("leave_room", () => {
                    beforeEach(async () => {
                        await clearAllModals();
                        await getComponentAndWaitForReady();
                        // this is thoroughly unit tested elsewhere
                        jest.spyOn(leaveRoomUtils, "leaveRoomBehaviour").mockClear().mockResolvedValue(undefined);
                    });
                    const dispatchAction = () =>
                        defaultDispatcher.dispatch({
                            action: "leave_room",
                            room_id: roomId,
                        });
                    const publicJoinRule = new MatrixEvent({
                        type: "m.room.join_rules",
                        content: {
                            join_rule: "public",
                        },
                    });
                    const inviteJoinRule = new MatrixEvent({
                        type: "m.room.join_rules",
                        content: {
                            join_rule: "invite",
                        },
                    });
                    describe("for a room", () => {
                        beforeEach(() => {
                            jest.spyOn(room.currentState, "getJoinedMemberCount").mockReturnValue(2);
                            jest.spyOn(room.currentState, "getStateEvents").mockReturnValue(publicJoinRule);
                        });
                        it("should launch a confirmation modal", async () => {
                            dispatchAction();
                            const dialog = await screen.findByRole("dialog");
                            expect(dialog).toMatchSnapshot();
                        });
                        it("should warn when room has only one joined member", async () => {
                            jest.spyOn(room.currentState, "getJoinedMemberCount").mockReturnValue(1);
                            dispatchAction();
                            await screen.findByRole("dialog");
                            expect(
                                screen.getByText(
                                    "You are the only person here. If you leave, no one will be able to join in the future, including you.",
                                ),
                            ).toBeInTheDocument();
                        });
                        it("should warn when room is not public", async () => {
                            jest.spyOn(room.currentState, "getStateEvents").mockReturnValue(inviteJoinRule);
                            dispatchAction();
                            await screen.findByRole("dialog");
                            expect(
                                screen.getByText(
                                    "This room is not public. You will not be able to rejoin without an invite.",
                                ),
                            ).toBeInTheDocument();
                        });
                        it("should do nothing on cancel", async () => {
                            dispatchAction();
                            const dialog = await screen.findByRole("dialog");
                            fireEvent.click(within(dialog).getByText("Cancel"));

                            await flushPromises();

                            expect(leaveRoomUtils.leaveRoomBehaviour).not.toHaveBeenCalled();
                            expect(defaultDispatcher.dispatch).not.toHaveBeenCalledWith({
                                action: Action.AfterLeaveRoom,
                                room_id: roomId,
                            });
                        });
                        it("should leave room and dispatch after leave action", async () => {
                            dispatchAction();
                            const dialog = await screen.findByRole("dialog");
                            fireEvent.click(within(dialog).getByText("Leave"));

                            await flushPromises();

                            expect(leaveRoomUtils.leaveRoomBehaviour).toHaveBeenCalled();
                            expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                                action: Action.AfterLeaveRoom,
                                room_id: roomId,
                            });
                        });
                    });

                    describe("for a space", () => {
                        const dispatchAction = () =>
                            defaultDispatcher.dispatch({
                                action: "leave_room",
                                room_id: spaceId,
                            });
                        beforeEach(() => {
                            jest.spyOn(spaceRoom.currentState, "getStateEvents").mockReturnValue(publicJoinRule);
                        });
                        it("should launch a confirmation modal", async () => {
                            dispatchAction();
                            const dialog = await screen.findByRole("dialog");
                            expect(dialog).toMatchSnapshot();
                        });
                        it("should warn when space is not public", async () => {
                            jest.spyOn(spaceRoom.currentState, "getStateEvents").mockReturnValue(inviteJoinRule);
                            dispatchAction();
                            await screen.findByRole("dialog");
                            expect(
                                screen.getByText(
                                    "This space is not public. You will not be able to rejoin without an invite.",
                                ),
                            ).toBeInTheDocument();
                        });
                    });
                });
            });
        });
    });

    describe("login via key/pass", () => {
        let loginClient!: ReturnType<typeof getMockClientWithEventEmitter>;

        const mockCrypto = {
            getVerificationRequestsToDeviceInProgress: jest.fn().mockReturnValue([]),
            getUserDeviceInfo: jest.fn().mockResolvedValue(new Map()),
        };

        const userName = "ernie";
        const password = "ilovebert";

        // make test results readable
        filterConsole("Failed to parse localStorage object");

        const getComponentAndWaitForReady = async (): Promise<RenderResult> => {
            const renderResult = getComponent();
            // wait for welcome page chrome render
            await screen.findByText("powered by Matrix");

            // go to login page
            defaultDispatcher.dispatch({
                action: "start_login",
            });

            await flushPromises();

            return renderResult;
        };

        const waitForSyncAndLoad = async (client: MatrixClient, withoutSecuritySetup?: boolean): Promise<void> => {
            // need to wait for different elements depending on which flow
            // without security setup we go to a loading page
            if (withoutSecuritySetup) {
                // we think we are logged in, but are still waiting for the /sync to complete
                await screen.findByText("Logout");
                // initial sync
                client.emit(ClientEvent.Sync, SyncState.Prepared, null);
                // wait for logged in view to load
                await screen.findByLabelText("User menu");

                // otherwise we stay on login and load from there for longer
            } else {
                // we are logged in, but are still waiting for the /sync to complete
                await screen.findByText("Syncing…");
                // initial sync
                client.emit(ClientEvent.Sync, SyncState.Prepared, null);
            }

            // let things settle
            await flushPromises();
            // and some more for good measure
            // this proved to be a little flaky
            await flushPromises();
        };

        const getComponentAndLogin = async (withoutSecuritySetup?: boolean): Promise<void> => {
            await getComponentAndWaitForReady();

            fireEvent.change(screen.getByLabelText("Username"), { target: { value: userName } });
            fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });

            // sign in button is an input
            fireEvent.click(screen.getByDisplayValue("Sign in"));

            await waitForSyncAndLoad(loginClient, withoutSecuritySetup);
        };

        beforeEach(() => {
            loginClient = getMockClientWithEventEmitter(getMockClientMethods());
            // this is used to create a temporary client during login
            jest.spyOn(MatrixJs, "createClient").mockReturnValue(loginClient);

            loginClient.login.mockClear().mockResolvedValue({});
            loginClient.loginFlows.mockClear().mockResolvedValue({ flows: [{ type: "m.login.password" }] });

            loginClient.getProfileInfo.mockResolvedValue({
                displayname: "Ernie",
            });
        });

        it("should render login page", async () => {
            await getComponentAndWaitForReady();

            expect(screen.getAllByText("Sign in")[0]).toBeInTheDocument();
        });

        describe("post login setup", () => {
            beforeEach(() => {
                loginClient.isCryptoEnabled.mockReturnValue(true);
                loginClient.getCrypto.mockReturnValue(mockCrypto as any);
                loginClient.userHasCrossSigningKeys.mockClear().mockResolvedValue(false);
            });

            it("should go straight to logged in view when crypto is not enabled", async () => {
                loginClient.isCryptoEnabled.mockReturnValue(false);

                await getComponentAndLogin(true);

                expect(loginClient.userHasCrossSigningKeys).not.toHaveBeenCalled();
            });

            it("should go straight to logged in view when user does not have cross signing keys and server does not support cross signing", async () => {
                loginClient.doesServerSupportUnstableFeature.mockResolvedValue(false);

                await getComponentAndLogin(false);

                expect(loginClient.doesServerSupportUnstableFeature).toHaveBeenCalledWith(
                    "org.matrix.e2e_cross_signing",
                );

                await flushPromises();

                // logged in
                await screen.findByLabelText("User menu");
            });

            it("should show complete security screen when user has cross signing setup", async () => {
                loginClient.userHasCrossSigningKeys.mockResolvedValue(true);

                await getComponentAndLogin();

                expect(loginClient.userHasCrossSigningKeys).toHaveBeenCalled();

                await flushPromises();

                // Complete security begin screen is rendered
                expect(screen.getByText("Unable to verify this device")).toBeInTheDocument();
            });

            it("should setup e2e when server supports cross signing", async () => {
                loginClient.doesServerSupportUnstableFeature.mockResolvedValue(true);

                await getComponentAndLogin();

                expect(loginClient.userHasCrossSigningKeys).toHaveBeenCalled();

                await flushPromises();

                // set up keys screen is rendered
                expect(screen.getByText("Setting up keys")).toBeInTheDocument();
            });
        });
    });
});
