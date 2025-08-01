/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// fake-indexeddb needs this and the tests crash without it
// https://github.com/dumbmatter/fakeIndexedDB?tab=readme-ov-file#jsdom-often-used-with-jest
import "core-js/stable/structured-clone";
import "fake-indexeddb/auto";
import React, { type ComponentProps } from "react";
import { fireEvent, render, type RenderResult, screen, waitFor, within, act } from "jest-matrix-react";
import fetchMock from "fetch-mock-jest";
import { type Mocked, mocked } from "jest-mock";
import { ClientEvent, type MatrixClient, MatrixEvent, Room, SyncState } from "matrix-js-sdk/src/matrix";
import { type MediaHandler } from "matrix-js-sdk/src/webrtc/mediaHandler";
import * as MatrixJs from "matrix-js-sdk/src/matrix";
import { completeAuthorizationCodeGrant } from "matrix-js-sdk/src/oidc/authorize";
import { logger } from "matrix-js-sdk/src/logger";
import { OidcError } from "matrix-js-sdk/src/oidc/error";
import { type BearerTokenResponse } from "matrix-js-sdk/src/oidc/validate";
import { sleep } from "matrix-js-sdk/src/utils";
import {
    CryptoEvent,
    type DeviceVerificationStatus,
    UserVerificationStatus,
    type CryptoApi,
} from "matrix-js-sdk/src/crypto-api";

import MatrixChat from "../../../../src/components/structures/MatrixChat";
import * as StorageAccess from "../../../../src/utils/StorageAccess";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import { UserTab } from "../../../../src/components/views/dialogs/UserTab";
import {
    clearAllModals,
    createStubMatrixRTC,
    filterConsole,
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    MockClientWithEventEmitter,
    mockPlatformPeg,
    resetJsDomAfterEach,
    unmockClientPeg,
} from "../../../test-utils";
import * as leaveRoomUtils from "../../../../src/utils/leave-behaviour";
import { OidcClientError } from "../../../../src/utils/oidc/error";
import LegacyCallHandler from "../../../../src/LegacyCallHandler";
import { CallStore } from "../../../../src/stores/CallStore";
import { type Call } from "../../../../src/models/Call";
import { PosthogAnalytics } from "../../../../src/PosthogAnalytics";
import PlatformPeg from "../../../../src/PlatformPeg";
import EventIndexPeg from "../../../../src/indexing/EventIndexPeg";
import * as Lifecycle from "../../../../src/Lifecycle";
import { SSO_HOMESERVER_URL_KEY, SSO_ID_SERVER_URL_KEY } from "../../../../src/BasePlatform";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { ReleaseAnnouncementStore } from "../../../../src/stores/ReleaseAnnouncementStore";
import { DRAFT_LAST_CLEANUP_KEY } from "../../../../src/DraftCleaner";
import { UIFeature } from "../../../../src/settings/UIFeature";
import AutoDiscoveryUtils from "../../../../src/utils/AutoDiscoveryUtils";
import { type ValidatedServerConfig } from "../../../../src/utils/ValidatedServerConfig";
import Modal from "../../../../src/Modal.tsx";
import { SetupEncryptionStore } from "../../../../src/stores/SetupEncryptionStore.ts";
import { ShareFormat } from "../../../../src/dispatcher/payloads/SharePayload.ts";
import { clearStorage } from "../../../../src/Lifecycle";
import RoomListStore from "../../../../src/stores/room-list/RoomListStore.ts";
import UserSettingsDialog from "../../../../src/components/views/dialogs/UserSettingsDialog.tsx";
import { SdkContextClass } from "../../../../src/contexts/SDKContext.ts";

jest.mock("matrix-js-sdk/src/oidc/authorize", () => ({
    completeAuthorizationCodeGrant: jest.fn(),
}));

// Stub out ThemeWatcher as the necessary bits for themes are done in element-web's index.html and thus are lacking here,
// plus JSDOM's implementation of CSSStyleDeclaration has a bunch of differences to real browsers which cause issues.
jest.mock("../../../../src/settings/watchers/ThemeWatcher");

/** The matrix versions our mock server claims to support */
const SERVER_SUPPORTED_MATRIX_VERSIONS = ["v1.1", "v1.5", "v1.6", "v1.8", "v1.9"];

describe("<MatrixChat />", () => {
    const userId = "@alice:server.org";
    const deviceId = "qwertyui";
    const accessToken = "abc123";
    const refreshToken = "def456";
    let bootstrapDeferred: PromiseWithResolvers<void>;
    // reused in createClient mock below
    const getMockClientMethods = () => ({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        getVersions: jest.fn().mockResolvedValue({ versions: SERVER_SUPPORTED_MATRIX_VERSIONS }),
        startClient: function () {
            // @ts-ignore
            this.emit(ClientEvent.Sync, SyncState.Prepared, null);
        },
        stopClient: jest.fn(),
        setCanResetTimelineCallback: jest.fn(),
        isInitialSyncComplete: jest.fn(),
        getSyncState: jest.fn(),
        getSsoLoginUrl: jest.fn(),
        getSyncStateData: jest.fn().mockReturnValue(null),
        getThirdpartyProtocols: jest.fn().mockResolvedValue({}),
        getClientWellKnown: jest.fn().mockReturnValue({}),
        isVersionSupported: jest.fn().mockResolvedValue(false),
        initRustCrypto: jest.fn(),
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
            startup: jest.fn(),
        },
        login: jest.fn(),
        loginFlows: jest.fn().mockResolvedValue({ flows: [] }),
        isGuest: jest.fn().mockReturnValue(false),
        clearStores: jest.fn(),
        setGuest: jest.fn(),
        setNotifTimelineSet: jest.fn(),
        getAccountData: jest.fn(),
        doesServerSupportUnstableFeature: jest.fn().mockResolvedValue(false),
        getDevices: jest.fn().mockResolvedValue({ devices: [] }),
        getProfileInfo: jest.fn().mockResolvedValue({
            displayname: "Ernie",
        }),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        getRooms: jest.fn().mockReturnValue([]),
        getCrypto: jest.fn().mockReturnValue({
            getVerificationRequestsToDeviceInProgress: jest.fn().mockReturnValue([]),
            isCrossSigningReady: jest.fn().mockReturnValue(false),
            isDehydrationSupported: jest.fn().mockReturnValue(false),
            getUserDeviceInfo: jest.fn().mockReturnValue(new Map()),
            getUserVerificationStatus: jest.fn().mockResolvedValue(new UserVerificationStatus(false, false, false)),
            getVersion: jest.fn().mockReturnValue("1"),
            setDeviceIsolationMode: jest.fn(),
            userHasCrossSigningKeys: jest.fn(),
            getActiveSessionBackupVersion: jest.fn().mockResolvedValue(null),
            globalBlacklistUnverifiedDevices: false,
            // This needs to not finish immediately because we need to test the screen appears
            bootstrapCrossSigning: jest.fn().mockImplementation(() => bootstrapDeferred.promise),
            getKeyBackupInfo: jest.fn().mockResolvedValue(null),
        }),
        secretStorage: {
            isStored: jest.fn().mockReturnValue(null),
        },
        matrixRTC: createStubMatrixRTC(),
        getDehydratedDevice: jest.fn(),
        whoami: jest.fn(),
        logout: jest.fn(),
        getDeviceId: jest.fn(),
        forget: () => Promise.resolve(),
    });
    let mockClient: Mocked<MatrixClient>;
    const serverConfig = {
        hsUrl: "https://test.com",
        hsName: "Test Server",
        hsNameIsDifferent: false,
        isUrl: "https://is.com",
        isDefault: true,
        isNameResolvable: true,
        warning: "",
    };
    let defaultProps: ComponentProps<typeof MatrixChat>;
    const getComponent = (props: Partial<ComponentProps<typeof MatrixChat>> = {}) => {
        return render(<MatrixChat {...defaultProps} {...props} />);
    };

    // make test results readable
    filterConsole(
        "Failed to parse localStorage object",
        "Sync store cannot be used on this browser",
        "Crypto store cannot be used on this browser",
        "Storage consistency checks failed",
        "LegacyCallHandler: missing <audio",
    );

    /** populate storage with details of a persisted session */
    async function populateStorageForSession() {
        localStorage.setItem("mx_hs_url", serverConfig.hsUrl);
        localStorage.setItem("mx_is_url", serverConfig.isUrl);
        // TODO: nowadays the access token lives (encrypted) in indexedDB, and localstorage is only used as a fallback.
        localStorage.setItem("mx_access_token", accessToken);
        localStorage.setItem("mx_user_id", userId);
        localStorage.setItem("mx_device_id", deviceId);
    }

    /**
     * Wait for a bunch of stuff to happen
     * between deciding we are logged in and removing the spinner
     * including waiting for initial sync
     */
    const waitForSyncAndLoad = async (client: MatrixClient, withoutSecuritySetup?: boolean): Promise<void> => {
        // need to wait for different elements depending on which flow
        // without security setup we go to a loading page
        if (withoutSecuritySetup) {
            // wait for logged in view to load
            await screen.findByLabelText("User menu");

            // otherwise we stay on login and load from there for longer
        } else {
            // we are logged in, but are still waiting for the /sync to complete
            await screen.findByText("Syncing…");
            // initial sync
            await act(() => client.emit(ClientEvent.Sync, SyncState.Prepared, null));
        }

        // let things settle
        await flushPromises();
        // and some more for good measure
        // this proved to be a little flaky
        await flushPromises();
    };

    beforeEach(async () => {
        await clearStorage();
        Lifecycle.setSessionLockNotStolen();

        localStorage.clear();
        jest.restoreAllMocks();
        defaultProps = {
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
            realQueryParams: {},
        };

        mockClient = getMockClientWithEventEmitter(getMockClientMethods());
        jest.spyOn(MatrixJs, "createClient").mockReturnValue(mockClient);

        jest.spyOn(defaultDispatcher, "dispatch").mockClear();
        jest.spyOn(defaultDispatcher, "fire").mockClear();

        DMRoomMap.makeShared(mockClient);

        jest.spyOn(AutoDiscoveryUtils, "validateServerConfigWithStaticUrls").mockResolvedValue(
            {} as ValidatedServerConfig,
        );

        bootstrapDeferred = Promise.withResolvers();

        await clearAllModals();
    });

    afterEach(async () => {
        // @ts-ignore
        DMRoomMap.setShared(null);

        // emit a loggedOut event so that all of the Store singletons forget about their references to the mock client
        // (must be sync otherwise the next test will start before it happens)
        act(() => defaultDispatcher.dispatch({ action: Action.OnLoggedOut }, true));

        localStorage.clear();

        // This is a massive hack, but ...
        //
        // A lot of these tests end up completing while the login flow is still proceeding. So then, we start the next
        // test while stuff is still ongoing from the previous test, which messes up the current test (by changing
        // localStorage or opening modals, or whatever).
        //
        // There is no obvious event we could wait for which indicates that everything has completed, since each test
        // does something different. Instead...
        await act(() => sleep(200));
    });

    resetJsDomAfterEach();

    it("should render spinner while app is loading", () => {
        const { container } = getComponent();

        expect(container).toMatchSnapshot();
    });

    it("should fire to focus the message composer", async () => {
        getComponent();
        defaultDispatcher.dispatch({ action: Action.ViewRoom, room_id: "!room:server.org", focusNext: "composer" });
        await waitFor(() => {
            expect(defaultDispatcher.fire).toHaveBeenCalledWith(Action.FocusSendMessageComposer);
        });
    });

    it("should fire to focus the threads panel", async () => {
        getComponent();
        defaultDispatcher.dispatch({ action: Action.ViewRoom, room_id: "!room:server.org", focusNext: "threadsPanel" });
        await waitFor(() => {
            expect(defaultDispatcher.fire).toHaveBeenCalledWith(Action.FocusThreadsPanel);
        });
    });

    describe("when query params have a OIDC params", () => {
        const issuer = "https://auth.com/";
        const homeserverUrl = "https://matrix.org";
        const identityServerUrl = "https://is.org";
        const clientId = "xyz789";

        const code = "test-oidc-auth-code";
        const state = "test-oidc-state";
        const realQueryParams = {
            code,
            state: state,
        };

        const deviceId = "test-device-id";
        const accessToken = "test-access-token-from-oidc";

        const tokenResponse: BearerTokenResponse = {
            access_token: accessToken,
            refresh_token: "def456",
            id_token: "ghi789",
            scope: "test",
            token_type: "Bearer",
            expires_at: 12345,
        };

        let loginClient!: ReturnType<typeof getMockClientWithEventEmitter>;

        const expectOIDCError = async (
            errorMessage = "Something went wrong during authentication. Go to the sign in page and try again.",
        ): Promise<void> => {
            await flushPromises();
            const dialog = await screen.findByRole("dialog");

            await waitFor(() => expect(within(dialog).getByText(errorMessage)).toBeInTheDocument());
        };

        beforeEach(() => {
            mocked(completeAuthorizationCodeGrant)
                .mockClear()
                .mockResolvedValue({
                    oidcClientSettings: {
                        clientId,
                        issuer,
                    },
                    tokenResponse,
                    homeserverUrl,
                    identityServerUrl,
                    idTokenClaims: {
                        aud: "123",
                        iss: issuer,
                        sub: "123",
                        exp: 123,
                        iat: 456,
                    },
                });

            loginClient = getMockClientWithEventEmitter(getMockClientMethods());
            // this is used to create a temporary client during login
            jest.spyOn(MatrixJs, "createClient").mockReturnValue(loginClient);

            jest.spyOn(logger, "error").mockClear();
            jest.spyOn(logger, "log").mockClear();

            loginClient.whoami.mockResolvedValue({
                user_id: userId,
                device_id: deviceId,
                is_guest: false,
            });
        });

        it("should fail when query params do not include valid code and state", async () => {
            const queryParams = {
                code: 123,
                state: "abc",
            };
            getComponent({ realQueryParams: queryParams });

            await flushPromises();

            expect(logger.error).toHaveBeenCalledWith(
                "Failed to login via OIDC",
                new Error(OidcClientError.InvalidQueryParameters),
            );

            await expectOIDCError();
        });

        it("should make correct request to complete authorization", async () => {
            getComponent({ realQueryParams });

            await flushPromises();

            expect(completeAuthorizationCodeGrant).toHaveBeenCalledWith(code, state);
        });

        it("should look up userId using access token", async () => {
            getComponent({ realQueryParams });

            await flushPromises();

            // check we used a client with the correct accesstoken
            expect(MatrixJs.createClient).toHaveBeenCalledWith({
                baseUrl: homeserverUrl,
                accessToken,
                idBaseUrl: identityServerUrl,
            });
            expect(loginClient.whoami).toHaveBeenCalled();
        });

        it("should log error and return to welcome page when userId lookup fails", async () => {
            loginClient.whoami.mockRejectedValue(new Error("oups"));
            getComponent({ realQueryParams });

            await flushPromises();

            expect(logger.error).toHaveBeenCalledWith(
                "Failed to login via OIDC",
                new Error("Failed to retrieve userId using accessToken"),
            );
            await expectOIDCError();
        });

        it("should call onTokenLoginCompleted", async () => {
            const onTokenLoginCompleted = jest.fn();
            getComponent({ realQueryParams, onTokenLoginCompleted });

            await waitFor(() => expect(onTokenLoginCompleted).toHaveBeenCalled());
        });

        describe("when login fails", () => {
            beforeEach(() => {
                mocked(completeAuthorizationCodeGrant).mockRejectedValue(new Error(OidcError.CodeExchangeFailed));
            });

            it("should log and return to welcome page with correct error when login state is not found", async () => {
                mocked(completeAuthorizationCodeGrant).mockRejectedValue(
                    new Error(OidcError.MissingOrInvalidStoredState),
                );
                getComponent({ realQueryParams });

                await flushPromises();

                expect(logger.error).toHaveBeenCalledWith(
                    "Failed to login via OIDC",
                    new Error(OidcError.MissingOrInvalidStoredState),
                );

                await expectOIDCError(
                    "We asked the browser to remember which homeserver you use to let you sign in, but unfortunately your browser has forgotten it. Go to the sign in page and try again.",
                );
            });

            it("should log and return to welcome page", async () => {
                getComponent({ realQueryParams });

                await flushPromises();

                expect(logger.error).toHaveBeenCalledWith(
                    "Failed to login via OIDC",
                    new Error(OidcError.CodeExchangeFailed),
                );

                // warning dialog
                await expectOIDCError();
            });

            it("should not clear storage", async () => {
                getComponent({ realQueryParams });

                await flushPromises();

                expect(loginClient.clearStores).not.toHaveBeenCalled();
            });

            it("should not store clientId or issuer", async () => {
                const sessionStorageSetSpy = jest.spyOn(sessionStorage.__proto__, "setItem");
                getComponent({ realQueryParams });

                await flushPromises();

                expect(sessionStorageSetSpy).not.toHaveBeenCalledWith("mx_oidc_client_id", clientId);
                expect(sessionStorageSetSpy).not.toHaveBeenCalledWith("mx_oidc_token_issuer", issuer);
            });
        });

        describe("when login succeeds", () => {
            beforeEach(() => {
                jest.spyOn(StorageAccess, "idbLoad").mockImplementation(
                    async (_table: string, key: string | string[]) => (key === "mx_access_token" ? accessToken : null),
                );
            });

            afterEach(() => {
                SettingsStore.reset();
            });

            it("should persist login credentials", async () => {
                getComponent({ realQueryParams });

                await waitFor(() => expect(localStorage.getItem("mx_device_id")).toEqual(deviceId));
                expect(localStorage.getItem("mx_hs_url")).toEqual(homeserverUrl);
                expect(localStorage.getItem("mx_user_id")).toEqual(userId);
                expect(localStorage.getItem("mx_has_access_token")).toEqual("true");
            });

            it("should store clientId and issuer in session storage", async () => {
                getComponent({ realQueryParams });

                await waitFor(() => expect(localStorage.getItem("mx_oidc_client_id")).toEqual(clientId));
                await waitFor(() => expect(localStorage.getItem("mx_oidc_token_issuer")).toEqual(issuer));
            });

            it("should set logged in and start MatrixClient", async () => {
                getComponent({ realQueryParams });

                defaultDispatcher.dispatch({
                    action: "will_start_client",
                });
                // client successfully started
                await waitFor(() =>
                    expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "client_started" }),
                );

                // check we get to logged in view
                await waitForSyncAndLoad(loginClient, true);
            });

            it("should persist device language when available", async () => {
                await SettingsStore.setValue("language", null, SettingLevel.DEVICE, "en");
                const languageBefore = SettingsStore.getValueAt(SettingLevel.DEVICE, "language", null, true, true);

                jest.spyOn(Lifecycle, "attemptDelegatedAuthLogin");

                getComponent({ realQueryParams });
                await flushPromises();

                expect(Lifecycle.attemptDelegatedAuthLogin).toHaveBeenCalled();
                const languageAfter = SettingsStore.getValueAt(SettingLevel.DEVICE, "language", null, true, true);
                expect(languageBefore).toEqual(languageAfter);
            });

            it("should not persist device language when not available", async () => {
                await SettingsStore.setValue("language", null, SettingLevel.DEVICE, undefined);
                const languageBefore = SettingsStore.getValueAt(SettingLevel.DEVICE, "language", null, true, true);

                jest.spyOn(Lifecycle, "attemptDelegatedAuthLogin");

                getComponent({ realQueryParams });
                await flushPromises();

                expect(Lifecycle.attemptDelegatedAuthLogin).toHaveBeenCalled();
                const languageAfter = SettingsStore.getValueAt(SettingLevel.DEVICE, "language", null, true, true);
                expect(languageBefore).toEqual(languageAfter);
            });
        });
    });

    describe("with an existing session", () => {
        const mockidb: Record<string, Record<string, string>> = {
            account: {
                mx_access_token: accessToken,
                mx_refresh_token: refreshToken,
            },
        };

        beforeEach(async () => {
            await populateStorageForSession();
            jest.spyOn(StorageAccess, "idbLoad").mockImplementation(async (table, key) => {
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

            // wait for logged in view to load
            await screen.findByLabelText("User menu");

            await screen.findByRole("heading", { level: 1, name: "Welcome Ernie" });
        });

        describe("clean up drafts", () => {
            const roomId = "!room:server.org";
            const unknownRoomId = "!room2:server.org";
            const room = new Room(roomId, mockClient, userId);
            const timestamp = 2345678901234;
            beforeEach(() => {
                localStorage.setItem(`mx_cider_state_${unknownRoomId}`, "fake_content");
                localStorage.setItem(`mx_cider_state_${roomId}`, "fake_content");
                mockClient.getRoom.mockImplementation((id) => [room].find((room) => room.roomId === id) || null);
            });
            it("should clean up drafts", async () => {
                Date.now = jest.fn(() => timestamp);
                localStorage.setItem(`mx_cider_state_${roomId}`, "fake_content");
                localStorage.setItem(`mx_cider_state_${unknownRoomId}`, "fake_content");
                await getComponentAndWaitForReady();
                mockClient.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);
                // let things settle
                await flushPromises();
                expect(localStorage.getItem(`mx_cider_state_${roomId}`)).not.toBeNull();
                expect(localStorage.getItem(`mx_cider_state_${unknownRoomId}`)).toBeNull();
            });

            it("should clean up wysiwyg drafts", async () => {
                Date.now = jest.fn(() => timestamp);
                localStorage.setItem(`mx_wysiwyg_state_${roomId}`, "fake_content");
                localStorage.setItem(`mx_wysiwyg_state_${unknownRoomId}`, "fake_content");
                await getComponentAndWaitForReady();
                mockClient.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);
                // let things settle
                await flushPromises();
                expect(localStorage.getItem(`mx_wysiwyg_state_${roomId}`)).not.toBeNull();
                expect(localStorage.getItem(`mx_wysiwyg_state_${unknownRoomId}`)).toBeNull();
            });

            it("should not clean up drafts before expiry", async () => {
                // Set the last cleanup to the recent past
                localStorage.setItem(`mx_cider_state_${unknownRoomId}`, "fake_content");
                localStorage.setItem(DRAFT_LAST_CLEANUP_KEY, String(timestamp - 100));
                await getComponentAndWaitForReady();
                mockClient.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Syncing);
                expect(localStorage.getItem(`mx_cider_state_${unknownRoomId}`)).not.toBeNull();
            });
        });

        describe("onAction()", () => {
            afterEach(() => {
                jest.restoreAllMocks();
            });

            it("ViewUserDeviceSettings should open user device settings", async () => {
                await getComponentAndWaitForReady();

                const createDialog = jest.spyOn(Modal, "createDialog").mockReturnValue({} as any);

                await act(async () => {
                    defaultDispatcher.dispatch({
                        action: Action.ViewUserDeviceSettings,
                    });

                    await waitFor(() =>
                        expect(createDialog).toHaveBeenCalledWith(
                            UserSettingsDialog,
                            { initialTabId: UserTab.SessionManager, sdkContext: expect.any(SdkContextClass) },
                            /*className=*/ undefined,
                            /*isPriority=*/ false,
                            /*isStatic=*/ true,
                        ),
                    );
                });
            });

            describe("room actions", () => {
                const roomId = "!room:server.org";
                const spaceId = "!spaceRoom:server.org";
                const room = new Room(roomId, mockClient, userId);
                const spaceRoom = new Room(spaceId, mockClient, userId);

                beforeEach(() => {
                    mockClient.getRoom.mockImplementation(
                        (id) => [room, spaceRoom].find((room) => room.roomId === id) || null,
                    );
                    jest.spyOn(spaceRoom, "isSpaceRoom").mockReturnValue(true);

                    jest.spyOn(ReleaseAnnouncementStore.instance, "getReleaseAnnouncement").mockReturnValue(null);
                });

                describe("forget_room", () => {
                    it("should dispatch after_forget_room action on successful forget", async () => {
                        await clearAllModals();
                        await getComponentAndWaitForReady();

                        // Mock out the old room list store
                        jest.spyOn(RoomListStore.instance, "manualRoomUpdate").mockImplementation(async () => {});

                        // Register a mock function to the dispatcher
                        const fn = jest.fn();
                        defaultDispatcher.register(fn);

                        // Forge the room
                        defaultDispatcher.dispatch({
                            action: "forget_room",
                            room_id: roomId,
                        });

                        // On success, we expect the following action to have been dispatched.
                        await waitFor(() => {
                            expect(fn).toHaveBeenCalledWith({
                                action: Action.AfterForgetRoom,
                                room: room,
                            });
                        });
                    });
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

                it("should open forward dialog when text message shared", async () => {
                    await getComponentAndWaitForReady();
                    defaultDispatcher.dispatch({ action: Action.Share, format: ShareFormat.Text, msg: "Hello world" });
                    await waitFor(() => {
                        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                            action: Action.OpenForwardDialog,
                            event: expect.any(MatrixEvent),
                            permalinkCreator: null,
                        });
                    });
                    const forwardCall = mocked(defaultDispatcher.dispatch).mock.calls.find(
                        ([call]) => call.action === Action.OpenForwardDialog,
                    );

                    const payload = forwardCall?.[0];

                    expect(payload!.event.getContent()).toEqual({
                        msgtype: MatrixJs.MsgType.Text,
                        body: "Hello world",
                    });
                });

                it("should open forward dialog when html message shared", async () => {
                    await getComponentAndWaitForReady();
                    defaultDispatcher.dispatch({ action: Action.Share, format: ShareFormat.Html, msg: "Hello world" });
                    await waitFor(() => {
                        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                            action: Action.OpenForwardDialog,
                            event: expect.any(MatrixEvent),
                            permalinkCreator: null,
                        });
                    });
                    const forwardCall = mocked(defaultDispatcher.dispatch).mock.calls.find(
                        ([call]) => call.action === Action.OpenForwardDialog,
                    );

                    const payload = forwardCall?.[0];

                    expect(payload!.event.getContent()).toEqual({
                        msgtype: MatrixJs.MsgType.Text,
                        format: "org.matrix.custom.html",
                        body: expect.stringContaining("Hello world"),
                        formatted_body: expect.stringContaining("Hello world"),
                    });
                });

                it("should open forward dialog when markdown message shared", async () => {
                    await getComponentAndWaitForReady();
                    defaultDispatcher.dispatch({
                        action: Action.Share,
                        format: ShareFormat.Markdown,
                        msg: "Hello *world*",
                    });
                    await waitFor(() => {
                        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                            action: Action.OpenForwardDialog,
                            event: expect.any(MatrixEvent),
                            permalinkCreator: null,
                        });
                    });
                    const forwardCall = mocked(defaultDispatcher.dispatch).mock.calls.find(
                        ([call]) => call.action === Action.OpenForwardDialog,
                    );

                    const payload = forwardCall?.[0];

                    expect(payload!.event.getContent()).toEqual({
                        msgtype: MatrixJs.MsgType.Text,
                        format: "org.matrix.custom.html",
                        body: "Hello *world*",
                        formatted_body: "Hello <em>world</em>",
                    });
                });

                it("should strip malicious tags from shared html message", async () => {
                    await getComponentAndWaitForReady();
                    defaultDispatcher.dispatch({
                        action: Action.Share,
                        format: ShareFormat.Html,
                        msg: `evil<script src="http://evil.dummy/bad.js" />`,
                    });
                    await waitFor(() => {
                        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                            action: Action.OpenForwardDialog,
                            event: expect.any(MatrixEvent),
                            permalinkCreator: null,
                        });
                    });
                    const forwardCall = mocked(defaultDispatcher.dispatch).mock.calls.find(
                        ([call]) => call.action === Action.OpenForwardDialog,
                    );

                    const payload = forwardCall?.[0];

                    expect(payload!.event.getContent()).toEqual({
                        msgtype: MatrixJs.MsgType.Text,
                        format: "org.matrix.custom.html",
                        body: "evil",
                        formatted_body: "evil",
                    });
                });
            });

            describe("logout", () => {
                let logoutClient!: ReturnType<typeof getMockClientWithEventEmitter>;
                const call1 = { disconnect: jest.fn() } as unknown as Call;
                const call2 = { disconnect: jest.fn() } as unknown as Call;

                const dispatchLogoutAndWait = async (): Promise<void> => {
                    defaultDispatcher.dispatch({
                        action: "logout",
                    });

                    await flushPromises();
                };

                beforeEach(() => {
                    // stub out various cleanup functions
                    jest.spyOn(LegacyCallHandler.instance, "hangupAllCalls")
                        .mockClear()
                        .mockImplementation(() => {});
                    jest.spyOn(PosthogAnalytics.instance, "logout").mockImplementation(() => {});
                    jest.spyOn(EventIndexPeg, "deleteEventIndex").mockImplementation(async () => {});

                    jest.spyOn(CallStore.instance, "connectedCalls", "get").mockReturnValue(new Set([call1, call2]));

                    mockPlatformPeg({
                        destroyPickleKey: jest.fn(),
                    });

                    logoutClient = getMockClientWithEventEmitter(getMockClientMethods());
                    mockClient = getMockClientWithEventEmitter(getMockClientMethods());
                    mockClient.logout.mockResolvedValue({});
                    mockClient.getDeviceId.mockReturnValue(deviceId);
                    // this is used to create a temporary client to cleanup after logout
                    jest.spyOn(MatrixJs, "createClient").mockClear().mockReturnValue(logoutClient);

                    jest.spyOn(logger, "warn").mockClear();
                });

                it("should hangup all legacy calls", async () => {
                    await getComponentAndWaitForReady();
                    await dispatchLogoutAndWait();
                    expect(LegacyCallHandler.instance.hangupAllCalls).toHaveBeenCalled();
                });

                it("should disconnect all calls", async () => {
                    await getComponentAndWaitForReady();
                    await dispatchLogoutAndWait();
                    expect(call1.disconnect).toHaveBeenCalled();
                    expect(call2.disconnect).toHaveBeenCalled();
                });

                it("should logout of posthog", async () => {
                    await getComponentAndWaitForReady();
                    await dispatchLogoutAndWait();

                    expect(PosthogAnalytics.instance.logout).toHaveBeenCalled();
                });

                it("should destroy pickle key", async () => {
                    await getComponentAndWaitForReady();
                    await dispatchLogoutAndWait();

                    expect(PlatformPeg.get()!.destroyPickleKey).toHaveBeenCalledWith(userId, deviceId);
                });

                describe("without delegated auth", () => {
                    it("should call /logout", async () => {
                        await getComponentAndWaitForReady();
                        await dispatchLogoutAndWait();

                        expect(mockClient.logout).toHaveBeenCalledWith(true);
                    });

                    it("should warn and do post-logout cleanup anyway when logout fails", async () => {
                        const error = new Error("test logout failed");
                        mockClient.logout.mockRejectedValue(error);
                        await getComponentAndWaitForReady();
                        await dispatchLogoutAndWait();

                        expect(logger.warn).toHaveBeenCalledWith(
                            "Failed to call logout API: token will not be invalidated",
                            error,
                        );

                        // stuff that happens in onloggedout
                        expect(defaultDispatcher.fire).toHaveBeenCalledWith(Action.OnLoggedOut, true);
                        await waitFor(() => expect(logoutClient.clearStores).toHaveBeenCalled());
                    });

                    it("should do post-logout cleanup", async () => {
                        await getComponentAndWaitForReady();
                        await dispatchLogoutAndWait();

                        // stuff that happens in onloggedout
                        expect(defaultDispatcher.fire).toHaveBeenCalledWith(Action.OnLoggedOut, true);
                        await waitFor(() => expect(EventIndexPeg.deleteEventIndex).toHaveBeenCalled());
                        expect(logoutClient.clearStores).toHaveBeenCalled();
                    });
                });
            });
        });

        describe("unskippable verification", () => {
            beforeEach(() => {
                // Force verification is turned on in settings
                defaultProps.config.force_verification = true;

                // And this device is being force-verified (because it logged in after
                // enforcement was turned on).
                localStorage.setItem("must_verify_device", "true");

                // lostKeys returns false, meaning there are other devices to verify against
                const realStore = SetupEncryptionStore.sharedInstance();
                jest.spyOn(realStore, "lostKeys").mockReturnValue(false);
            });

            afterEach(() => {
                jest.restoreAllMocks();
                // Reset things back to how they were before we started
                defaultProps.config.force_verification = false;
                localStorage.removeItem("must_verify_device");
            });

            it("should show the Complete Security screen if unskippable verification is enabled", async () => {
                // Given we have force verification on, and an existing logged-in session
                // that is not verified (see beforeEach())

                // When we render MatrixChat
                getComponent();

                // Then we are asked to verify our device
                await screen.findByRole("heading", { name: "Verify this device", level: 1 });

                // Sanity: we are not racing with another screen update, so this heading stays visible
                await screen.findByRole("heading", { name: "Verify this device", level: 1 });
            });
            it("should not open app after cancelling device verify if unskippable verification is on", async () => {
                // See https://github.com/element-hq/element-web/issues/29230
                // We used to allow bypassing force verification by choosing "Verify with
                // another device" and not completing the verification.

                // Given we have force verification on, and an existing logged-in session
                // that is not verified (see beforeEach())

                // And our crypto is set up
                mockClient.getCrypto.mockReturnValue(createMockCrypto());

                // And MatrixChat is rendered
                getComponent();

                // When we click "Verify with another device"
                await screen.findByRole("heading", { name: "Verify this device", level: 1 });
                const verify = screen.getByRole("button", { name: "Verify with another device" });
                act(() => verify.click());

                // And close the device verification dialog
                const closeButton = await screen.findByRole("button", { name: "Close dialog" });
                act(() => closeButton.click());

                // Then we are not allowed in - we are still being asked to verify
                await screen.findByRole("heading", { name: "Verify this device", level: 1 });
            });

            describe("when query params have a loginToken", () => {
                const loginToken = "test-login-token";
                const realQueryParams = {
                    loginToken,
                };

                let loginClient!: ReturnType<typeof getMockClientWithEventEmitter>;
                const deviceId = "test-device-id";
                const accessToken = "test-access-token";
                const clientLoginResponse = {
                    user_id: userId,
                    device_id: deviceId,
                    access_token: accessToken,
                };

                beforeEach(() => {
                    localStorage.setItem("mx_sso_hs_url", serverConfig.hsUrl);
                    localStorage.setItem("mx_sso_is_url", serverConfig.isUrl);
                    loginClient = getMockClientWithEventEmitter(getMockClientMethods());
                    // this is used to create a temporary client during login
                    jest.spyOn(MatrixJs, "createClient").mockReturnValue(loginClient);

                    loginClient.login.mockClear().mockResolvedValue(clientLoginResponse);
                });

                it("should show the Complete Security screen after OIDC login if unskippable ver. is on", async () => {
                    // Given force_verification is on (outer describe)
                    // And we just logged in via OIDC (inner describe)

                    // When we load the page
                    getComponent({ realQueryParams });

                    defaultDispatcher.dispatch({
                        action: "will_start_client",
                    });
                    await waitFor(() =>
                        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "client_started" }),
                    );

                    // Then we are not allowed in - we are being asked to verify
                    await screen.findByRole("heading", { name: "Verify this device", level: 1 });
                });
            });

            function createMockCrypto(): CryptoApi {
                return {
                    getVersion: jest.fn().mockReturnValue("Version 0"),
                    getVerificationRequestsToDeviceInProgress: jest.fn().mockReturnValue([]),
                    getUserDeviceInfo: jest.fn().mockReturnValue({
                        get: jest
                            .fn()
                            .mockReturnValue(
                                new Map([
                                    ["devid", { dehydrated: false, getIdentityKey: jest.fn().mockReturnValue("k") }],
                                ]),
                            ),
                    }),
                    getUserVerificationStatus: jest
                        .fn()
                        .mockResolvedValue(new UserVerificationStatus(true, true, false)),
                    setDeviceIsolationMode: jest.fn(),
                    isDehydrationSupported: jest.fn().mockReturnValue(false),
                    getDeviceVerificationStatus: jest
                        .fn()
                        .mockResolvedValue({ signedByOwner: true } as DeviceVerificationStatus),
                    isCrossSigningReady: jest.fn().mockReturnValue(false),
                    requestOwnUserVerification: jest.fn().mockResolvedValue({ cancel: jest.fn() }),
                } as any;
            }
        });

        describe("showScreen", () => {
            it("should show the 'share' screen", async () => {
                await getComponent({
                    initialScreenAfterLogin: { screen: "share", params: { msg: "Hello", format: ShareFormat.Text } },
                });

                await waitFor(() => {
                    expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                        action: "share",
                        msg: "Hello",
                        format: ShareFormat.Text,
                    });
                });
            });
        });
    });

    describe("with a soft-logged-out session", () => {
        const mockidb: Record<string, Record<string, string>> = {};

        beforeEach(async () => {
            await populateStorageForSession();
            localStorage.setItem("mx_soft_logout", "true");

            mockClient.loginFlows.mockResolvedValue({ flows: [{ type: "m.login.password" }] });

            jest.spyOn(StorageAccess, "idbLoad").mockImplementation(async (table, key) => {
                const safeKey = Array.isArray(key) ? key[0] : key;
                return mockidb[table]?.[safeKey];
            });
        });

        it("should show the soft-logout page", async () => {
            // XXX This test is strange, it was working with legacy crypto
            // without mocking the following but the initCrypto call was failing
            // but as the exception was swallowed, the test was passing (see in `initClientCrypto`).
            // There are several uses of the peg in the app, so during all these tests you might end-up
            // with a real client instead of the mocked one. Not sure how reliable all these tests are.
            jest.spyOn(MatrixClientPeg, "replaceUsingCreds");
            jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);

            const result = getComponent();

            await result.findByText("You're signed out");
            expect(result.container).toMatchSnapshot();
        });
    });

    describe("login via key/pass", () => {
        let loginClient!: ReturnType<typeof getMockClientWithEventEmitter>;

        const userName = "ernie";
        const password = "ilovebert";

        const getComponentAndWaitForReady = async (): Promise<RenderResult> => {
            const renderResult = getComponent();
            // wait for welcome page chrome render
            await screen.findByText("Powered by Matrix");

            // go to login page
            act(() =>
                defaultDispatcher.dispatch({
                    action: "start_login",
                }),
            );

            await flushPromises();

            return renderResult;
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
            // FIXME: except it is *also* used as the permanent client for the rest of the test.
            jest.spyOn(MatrixJs, "createClient").mockClear().mockReturnValue(loginClient);

            loginClient.login.mockClear().mockResolvedValue({
                access_token: "TOKEN",
                device_id: "IMADEVICE",
                user_id: userId,
            });
            loginClient.loginFlows.mockClear().mockResolvedValue({ flows: [{ type: "m.login.password" }] });
        });

        it("should render login page", async () => {
            await getComponentAndWaitForReady();

            expect(screen.getAllByText("Sign in")[0]).toBeInTheDocument();
        });

        describe("post login setup", () => {
            beforeEach(() => {
                const mockCrypto = {
                    getVersion: jest.fn().mockReturnValue("Version 0"),
                    getVerificationRequestsToDeviceInProgress: jest.fn().mockReturnValue([]),
                    getUserDeviceInfo: jest.fn().mockResolvedValue(new Map()),
                    getUserVerificationStatus: jest
                        .fn()
                        .mockResolvedValue(new UserVerificationStatus(false, false, false)),
                    setDeviceIsolationMode: jest.fn(),
                    userHasCrossSigningKeys: jest.fn().mockResolvedValue(false),
                    // This needs to not finish immediately because we need to test the screen appears
                    bootstrapCrossSigning: jest.fn().mockImplementation(() => bootstrapDeferred.promise),
                    resetKeyBackup: jest.fn(),
                    isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(false),
                    checkKeyBackupAndEnable: jest.fn().mockResolvedValue(null),
                    isDehydrationSupported: jest.fn().mockReturnValue(false),
                };
                loginClient.getCrypto.mockReturnValue(mockCrypto as any);
            });

            it("should go straight to logged in view when crypto is not enabled", async () => {
                loginClient.getCrypto.mockReturnValue(undefined);

                await getComponentAndLogin(true);

                expect(screen.getByRole("heading", { name: "Welcome Ernie" })).toBeInTheDocument();
            });

            it("should go straight to logged in view when user does not have cross signing keys and server does not support cross signing", async () => {
                loginClient.doesServerSupportUnstableFeature.mockResolvedValue(false);

                await getComponentAndLogin(false);

                expect(loginClient.doesServerSupportUnstableFeature).toHaveBeenCalledWith(
                    "org.matrix.e2e_cross_signing",
                );

                // logged in
                await screen.findByLabelText("User menu");
            });

            describe("when server supports cross signing and user does not have cross signing setup", () => {
                beforeEach(() => {
                    loginClient.doesServerSupportUnstableFeature.mockResolvedValue(true);
                    jest.spyOn(loginClient.getCrypto()!, "userHasCrossSigningKeys").mockResolvedValue(false);
                });

                describe("when encryption is force disabled", () => {
                    let unencryptedRoom: Room;
                    let encryptedRoom: Room;

                    beforeEach(() => {
                        unencryptedRoom = new Room("!unencrypted:server.org", loginClient, userId);
                        encryptedRoom = new Room("!encrypted:server.org", loginClient, userId);

                        loginClient.getClientWellKnown.mockReturnValue({
                            "io.element.e2ee": {
                                force_disable: true,
                            },
                        });

                        jest.spyOn(loginClient.getCrypto()!, "isEncryptionEnabledInRoom").mockImplementation(
                            async (roomId) => {
                                return roomId === encryptedRoom.roomId;
                            },
                        );
                    });

                    it("should go straight to logged in view when user is not in any encrypted rooms", async () => {
                        loginClient.getRooms.mockReturnValue([unencryptedRoom]);
                        await getComponentAndLogin(false);

                        await flushPromises();

                        // logged in, did not setup keys
                        await screen.findByLabelText("User menu");
                    });

                    it("should go to setup e2e screen when user is in encrypted rooms", async () => {
                        loginClient.getRooms.mockReturnValue([unencryptedRoom, encryptedRoom]);
                        await getComponentAndLogin();
                        await flushPromises();
                        // set up keys screen is rendered
                        expect(screen.getByText("Setting up keys")).toBeInTheDocument();
                    });
                });

                it("should go to setup e2e screen", async () => {
                    loginClient.doesServerSupportUnstableFeature.mockResolvedValue(true);

                    await getComponentAndLogin();

                    expect(loginClient.getCrypto()!.userHasCrossSigningKeys).toHaveBeenCalled();

                    // set up keys screen is rendered
                    await expect(await screen.findByText("Setting up keys")).toBeInTheDocument();
                });
            });

            it("should show complete security screen when user has cross signing setup", async () => {
                jest.spyOn(loginClient.getCrypto()!, "userHasCrossSigningKeys").mockResolvedValue(true);

                await getComponentAndLogin();

                expect(loginClient.getCrypto()!.userHasCrossSigningKeys).toHaveBeenCalled();

                await flushPromises();

                // Complete security begin screen is rendered
                expect(screen.getByText("Unable to verify this device")).toBeInTheDocument();
            });

            it("should setup e2e when server supports cross signing", async () => {
                loginClient.doesServerSupportUnstableFeature.mockResolvedValue(true);

                await getComponentAndLogin();

                expect(loginClient.getCrypto()!.userHasCrossSigningKeys).toHaveBeenCalled();

                // set up keys screen is rendered
                expect(screen.getByText("Setting up keys")).toBeInTheDocument();
            });
        });
    });

    describe("when query params have a loginToken", () => {
        const loginToken = "test-login-token";
        const realQueryParams = {
            loginToken,
        };

        let loginClient!: ReturnType<typeof getMockClientWithEventEmitter>;
        const deviceId = "test-device-id";
        const accessToken = "test-access-token";
        const clientLoginResponse = {
            user_id: userId,
            device_id: deviceId,
            access_token: accessToken,
        };

        beforeEach(() => {
            localStorage.setItem("mx_sso_hs_url", serverConfig.hsUrl);
            localStorage.setItem("mx_sso_is_url", serverConfig.isUrl);
            loginClient = getMockClientWithEventEmitter(getMockClientMethods());
            // this is used to create a temporary client during login
            jest.spyOn(MatrixJs, "createClient").mockReturnValue(loginClient);

            loginClient.login.mockClear().mockResolvedValue(clientLoginResponse);
        });

        it("should show an error dialog when no homeserver is found in local storage", async () => {
            localStorage.removeItem("mx_sso_hs_url");
            const localStorageGetSpy = jest.spyOn(localStorage.__proto__, "getItem");
            getComponent({ realQueryParams });
            await flushPromises();

            expect(localStorageGetSpy).toHaveBeenCalledWith("mx_sso_hs_url");
            expect(localStorageGetSpy).toHaveBeenCalledWith("mx_sso_is_url");

            const dialog = await screen.findByRole("dialog");

            // warning dialog
            expect(
                within(dialog).getByText(
                    "We asked the browser to remember which homeserver you use to let you sign in, " +
                        "but unfortunately your browser has forgotten it. Go to the sign in page and try again.",
                ),
            ).toBeInTheDocument();
        });

        it("should attempt token login", async () => {
            getComponent({ realQueryParams });
            await flushPromises();

            expect(loginClient.login).toHaveBeenCalledWith("m.login.token", {
                initial_device_display_name: undefined,
                token: loginToken,
            });
        });

        it("should call onTokenLoginCompleted", async () => {
            const onTokenLoginCompleted = jest.fn();
            getComponent({ realQueryParams, onTokenLoginCompleted });

            await waitFor(() => expect(onTokenLoginCompleted).toHaveBeenCalled());
        });

        describe("when login fails", () => {
            beforeEach(() => {
                loginClient.login.mockRejectedValue(new Error("oups"));
            });
            it("should show a dialog", async () => {
                getComponent({ realQueryParams });

                await flushPromises();

                const dialog = await screen.findByRole("dialog");

                // warning dialog
                expect(
                    within(dialog).getByText(
                        "There was a problem communicating with the homeserver, please try again later.",
                    ),
                ).toBeInTheDocument();
            });

            it("should not clear storage", async () => {
                getComponent({ realQueryParams });

                await flushPromises();

                expect(loginClient.clearStores).not.toHaveBeenCalled();
            });
        });

        describe("when login succeeds", () => {
            beforeEach(() => {
                jest.spyOn(StorageAccess, "idbLoad").mockImplementation(
                    async (_table: string, key: string | string[]) => {
                        if (key === "mx_access_token") {
                            return accessToken as any;
                        }
                    },
                );
            });

            it("should clear storage", async () => {
                const localStorageClearSpy = jest.spyOn(localStorage.__proto__, "clear");

                getComponent({ realQueryParams });

                // just check we called the clearStorage function
                await waitFor(() => expect(loginClient.clearStores).toHaveBeenCalled());
                expect(localStorage.getItem("mx_sso_hs_url")).toBe(null);
                expect(localStorageClearSpy).toHaveBeenCalled();
            });

            it("should persist login credentials", async () => {
                getComponent({ realQueryParams });

                await waitFor(() => expect(localStorage.getItem("mx_hs_url")).toEqual(serverConfig.hsUrl));
                expect(localStorage.getItem("mx_user_id")).toEqual(userId);
                expect(localStorage.getItem("mx_has_access_token")).toEqual("true");
                expect(localStorage.getItem("mx_device_id")).toEqual(deviceId);
            });

            it("should set fresh login flag in session storage", async () => {
                const sessionStorageSetSpy = jest.spyOn(sessionStorage.__proto__, "setItem");
                getComponent({ realQueryParams });

                await waitFor(() => expect(sessionStorageSetSpy).toHaveBeenCalledWith("mx_fresh_login", "true"));
            });

            it("should override hsUrl in creds when login response wellKnown differs from config", async () => {
                const hsUrlFromWk = "https://hsfromwk.org";
                const loginResponseWithWellKnown = {
                    ...clientLoginResponse,
                    well_known: {
                        "m.homeserver": {
                            base_url: hsUrlFromWk,
                        },
                    },
                };
                loginClient.login.mockResolvedValue(loginResponseWithWellKnown);
                getComponent({ realQueryParams });

                await waitFor(() => expect(localStorage.getItem("mx_hs_url")).toEqual(hsUrlFromWk));
            });

            it("should continue to post login setup when no session is found in local storage", async () => {
                getComponent({ realQueryParams });
                defaultDispatcher.dispatch({
                    action: "will_start_client",
                });

                // logged in but waiting for sync screen
                await screen.findByText("Logout");
            });
        });
    });

    describe("automatic SSO selection", () => {
        let ssoClient: ReturnType<typeof getMockClientWithEventEmitter>;
        let hrefSetter: jest.Mock<void, [string]>;
        beforeEach(() => {
            ssoClient = getMockClientWithEventEmitter({
                ...getMockClientMethods(),
                getHomeserverUrl: jest.fn().mockReturnValue("matrix.example.com"),
                getIdentityServerUrl: jest.fn().mockReturnValue("ident.example.com"),
                getSsoLoginUrl: jest.fn().mockReturnValue("http://my-sso-url"),
            });
            // this is used to create a temporary client to cleanup after logout
            jest.spyOn(MatrixJs, "createClient").mockClear().mockReturnValue(ssoClient);
            mockPlatformPeg();
            // Ensure we don't have a client peg as we aren't logged in.
            unmockClientPeg();

            hrefSetter = jest.fn();
            const originalHref = window.location.href.toString();
            Object.defineProperty(window, "location", {
                value: {
                    get href() {
                        return originalHref;
                    },
                    set href(href) {
                        hrefSetter(href);
                    },
                },
                writable: true,
            });
        });

        it("should automatically setup and redirect to SSO login", async () => {
            getComponent({
                initialScreenAfterLogin: {
                    screen: "start_sso",
                },
            });

            await waitFor(() =>
                expect(ssoClient.getSsoLoginUrl).toHaveBeenCalledWith("http://localhost/", "sso", undefined, undefined),
            );
            expect(window.localStorage.getItem(SSO_HOMESERVER_URL_KEY)).toEqual("matrix.example.com");
            expect(window.localStorage.getItem(SSO_ID_SERVER_URL_KEY)).toEqual("ident.example.com");
            expect(hrefSetter).toHaveBeenCalledWith("http://my-sso-url");
        });

        it("should automatically setup and redirect to CAS login", async () => {
            getComponent({
                initialScreenAfterLogin: {
                    screen: "start_cas",
                },
            });

            await waitFor(() =>
                expect(ssoClient.getSsoLoginUrl).toHaveBeenCalledWith("http://localhost/", "cas", undefined, undefined),
            );
            expect(window.localStorage.getItem(SSO_HOMESERVER_URL_KEY)).toEqual("matrix.example.com");
            expect(window.localStorage.getItem(SSO_ID_SERVER_URL_KEY)).toEqual("ident.example.com");
            expect(hrefSetter).toHaveBeenCalledWith("http://my-sso-url");
        });
    });

    describe("Multi-tab lockout", () => {
        afterEach(() => {
            Lifecycle.setSessionLockNotStolen();
        });

        // Flaky test, see https://github.com/element-hq/element-web/issues/30337
        it("waits for other tab to stop during startup", async () => {
            fetchMock.get("/welcome.html", { body: "<h1>Hello</h1>" });
            jest.spyOn(Lifecycle, "attemptDelegatedAuthLogin");

            // simulate an active window
            localStorage.setItem("react_sdk_session_lock_ping", String(Date.now()));

            const rendered = getComponent({});
            await flushPromises();
            expect(rendered.container).toMatchSnapshot();

            // user confirms
            rendered.getByRole("button", { name: "Continue" }).click();
            await flushPromises();

            // we should have claimed the session, but gone no further
            expect(Lifecycle.attemptDelegatedAuthLogin).not.toHaveBeenCalled();
            const sessionId = localStorage.getItem("react_sdk_session_lock_claimant");
            expect(sessionId).toEqual(expect.stringMatching(/./));
            expect(rendered.container).toMatchSnapshot();

            // the other tab shuts down
            localStorage.removeItem("react_sdk_session_lock_ping");
            // fire the storage event manually, because writes to localStorage from the same javascript context don't
            // fire it automatically
            window.dispatchEvent(new StorageEvent("storage", { key: "react_sdk_session_lock_ping" }));

            // startup continues
            await flushPromises();
            expect(Lifecycle.attemptDelegatedAuthLogin).toHaveBeenCalled();

            // should just show the welcome screen
            await rendered.findByText("Hello");
            expect(rendered.container).toMatchSnapshot();
        });

        describe("shows the lockout page when a second tab opens", () => {
            beforeEach(() => {
                // make sure we start from a clean DOM for each of these tests
                document.body.replaceChildren();
            });

            function simulateSessionLockClaim() {
                localStorage.setItem("react_sdk_session_lock_claimant", "testtest");
                act(() =>
                    window.dispatchEvent(new StorageEvent("storage", { key: "react_sdk_session_lock_claimant" })),
                );
            }

            it("after a session is restored", async () => {
                await populateStorageForSession();

                const client = getMockClientWithEventEmitter(getMockClientMethods());
                jest.spyOn(MatrixJs, "createClient").mockReturnValue(client);

                const rendered = getComponent({});
                await waitForSyncAndLoad(client, true);
                rendered.getByText("Welcome Ernie");

                // we're now at the welcome page. Another session wants the lock...
                simulateSessionLockClaim();
                await flushPromises();
                expect(rendered.container).toMatchSnapshot();
            });

            it("while we were waiting for the lock ourselves", async () => {
                // simulate there already being one session
                localStorage.setItem("react_sdk_session_lock_ping", String(Date.now()));

                const rendered = getComponent({});
                await flushPromises();

                // user confirms continue
                rendered.getByRole("button", { name: "Continue" }).click();
                await flushPromises();
                expect(rendered.getByTestId("spinner")).toBeInTheDocument();

                // now a third session starts
                simulateSessionLockClaim();
                await flushPromises();
                expect(rendered.container).toMatchSnapshot();
            });

            it("while we are checking the sync store", async () => {
                const rendered = getComponent({});
                expect(rendered.getByTestId("spinner")).toBeInTheDocument();

                // now a third session starts
                simulateSessionLockClaim();
                await flushPromises();
                expect(rendered.container).toMatchSnapshot();
            });

            it("during crypto init", async () => {
                await populateStorageForSession();

                const client = new MockClientWithEventEmitter({
                    ...getMockClientMethods(),
                }) as unknown as Mocked<MatrixClient>;
                jest.spyOn(MatrixJs, "createClient").mockReturnValue(client);

                // intercept initCrypto and have it block until we complete the deferred
                const initCryptoCompleteDefer = Promise.withResolvers<void>();
                const initCryptoCalled = new Promise<void>((resolve) => {
                    client.initRustCrypto.mockImplementation(() => {
                        resolve();
                        return initCryptoCompleteDefer.promise;
                    });
                });

                const rendered = getComponent({});
                await initCryptoCalled;
                console.log("initCrypto called");

                simulateSessionLockClaim();
                await flushPromises();

                // now we should see the error page
                rendered.getByText("Test is connected in another tab");

                // let initCrypto complete, and check we don't get a modal
                initCryptoCompleteDefer.resolve();
                await sleep(10); // Modals take a few ms to appear
                expect(document.body).toMatchSnapshot();
            });
        });
    });

    describe("mobile registration", () => {
        const getComponentAndWaitForReady = async (): Promise<RenderResult> => {
            const renderResult = getComponent();
            // wait for welcome page chrome render
            await screen.findByText("Powered by Matrix");

            // go to mobile_register page
            defaultDispatcher.dispatch({
                action: "start_mobile_registration",
            });

            return renderResult;
        };

        const enabledMobileRegistration = (): void => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName): any => {
                if (settingName === "Registration.mobileRegistrationHelper") return true;
                if (settingName === UIFeature.Registration) return true;
            });
        };

        it("should render welcome screen if mobile registration is not enabled in settings", async () => {
            await getComponentAndWaitForReady();

            await screen.findByText("Powered by Matrix");
        });

        it("should render mobile registration", async () => {
            enabledMobileRegistration();

            await getComponentAndWaitForReady();
            await flushPromises();

            expect(screen.getByTestId("mobile-register")).toBeInTheDocument();
        });
    });

    describe("when key backup failed", () => {
        it("should show the new recovery method dialog", async () => {
            const spy = jest.spyOn(Modal, "createDialog");
            jest.mock("../../../../src/async-components/views/dialogs/security/NewRecoveryMethodDialog", () => ({
                __test: true,
                __esModule: true,
                default: () => <span>mocked dialog</span>,
            }));
            jest.spyOn(mockClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("version");

            getComponent({});
            defaultDispatcher.dispatch({
                action: "will_start_client",
            });
            await flushPromises();
            mockClient.emit(CryptoEvent.KeyBackupFailed, "error code");
            await waitFor(() =>
                expect(spy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        _payload: expect.objectContaining({ _result: expect.objectContaining({ __test: true }) }),
                    }),
                ),
            );
        });

        it("should show the recovery method removed dialog", async () => {
            const spy = jest.spyOn(Modal, "createDialog");
            jest.mock("../../../../src/async-components/views/dialogs/security/RecoveryMethodRemovedDialog", () => ({
                __test: true,
                __esModule: true,
                default: () => <span>mocked dialog</span>,
            }));

            getComponent({});
            defaultDispatcher.dispatch({
                action: "will_start_client",
            });
            await flushPromises();
            mockClient.emit(CryptoEvent.KeyBackupFailed, "error code");
            await waitFor(() =>
                expect(spy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        _payload: expect.objectContaining({ _result: expect.objectContaining({ __test: true }) }),
                    }),
                ),
            );
        });
    });
});
