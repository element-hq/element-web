/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { type MethodLikeKeys, mocked, type MockedObject, type PropertyLikeKeys } from "jest-mock";
import { Feature, ServerSupport } from "matrix-js-sdk/src/feature";
import { type MatrixClient, type Room, MatrixError, User } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../src/MatrixClientPeg";

/**
 * Mocked generic class with a real EventEmitter.
 * Useful for mocks which need event emitters.
 */
export class MockEventEmitter<T> extends EventEmitter {
    /**
     * Construct a new event emitter with additional properties/functions. The event emitter functions
     * like .emit and .on will be real.
     * @param mockProperties An object with the mock property or function implementations. 'getters'
     * are correctly cloned to this event emitter.
     */
    constructor(mockProperties: Partial<Record<MethodLikeKeys<T> | PropertyLikeKeys<T>, unknown>> = {}) {
        super();
        // We must use defineProperties and not assign as the former clones getters correctly,
        // whereas the latter invokes the getter and sets the return value permanently on the
        // destination object.
        Object.defineProperties(this, Object.getOwnPropertyDescriptors(mockProperties));
    }
}

/**
 * Mock client with real event emitter
 * useful for testing code that listens
 * to MatrixClient events
 */
export class MockClientWithEventEmitter extends EventEmitter {
    constructor(mockProperties: Partial<Record<MethodLikeKeys<MatrixClient>, unknown>> = {}) {
        super();

        Object.assign(this, mockProperties);
    }
}

/**
 * - make a mock client
 * - cast the type to mocked(MatrixClient)
 * - spy on MatrixClientPeg.get to return the mock
 * eg
 * ```
 * const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(aliceId),
    });
 * ```
 *
 * See also {@link stubClient} which does something similar but uses a more complete mock client.
 */
export const getMockClientWithEventEmitter = (
    mockProperties: Partial<Record<keyof MatrixClient, unknown>>,
): MockedObject<MatrixClient> => {
    const mock = mocked(new MockClientWithEventEmitter(mockProperties) as unknown as MatrixClient);

    jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mock);
    jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mock);

    // @ts-ignore simplified test stub
    mock.canSupport = new Map();
    Object.keys(Feature).forEach((feature) => {
        mock.canSupport.set(feature as Feature, ServerSupport.Stable);
    });
    return mock;
};

export const unmockClientPeg = () => {
    jest.spyOn(MatrixClientPeg, "get").mockRestore();
    jest.spyOn(MatrixClientPeg, "safeGet").mockRestore();
};

/**
 * Returns basic mocked client methods related to the current user
 * ```
 * const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser('@mytestuser:domain'),
    });
 * ```
 */
export const mockClientMethodsUser = (userId = "@alice:domain") => ({
    getUserId: jest.fn().mockReturnValue(userId),
    getDomain: jest.fn().mockReturnValue(userId.split(":")[1]),
    getSafeUserId: jest.fn().mockReturnValue(userId),
    getUser: jest.fn().mockReturnValue(new User(userId)),
    isGuest: jest.fn().mockReturnValue(false),
    mxcUrlToHttp: jest.fn().mockReturnValue("mock-mxcUrlToHttp"),
    credentials: { userId },
    getThreePids: jest.fn().mockResolvedValue({ threepids: [] }),
    getAccessToken: jest.fn(),
    getDeviceId: jest.fn(),
    getAccountData: jest.fn(),
});

/**
 * Returns basic mocked client methods related to rendering events
 * ```
 * const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser('@mytestuser:domain'),
    });
 * ```
 */
export const mockClientMethodsEvents = () => ({
    decryptEventIfNeeded: jest.fn(),
    getPushActionsForEvent: jest.fn(),
});

/**
 * Returns basic mocked pushProcessor
 */
export const mockClientPushProcessor = () => ({
    pushProcessor: {
        getPushRuleById: jest.fn(),
        ruleMatchesEvent: jest.fn(),
    },
});

/**
 * Returns basic mocked client methods related to server support
 */
export const mockClientMethodsServer = (): Partial<Record<MethodLikeKeys<MatrixClient>, unknown>> => ({
    getIdentityServerUrl: jest.fn(),
    getHomeserverUrl: jest.fn(),
    getCapabilities: jest.fn().mockResolvedValue({}),
    getClientWellKnown: jest.fn().mockReturnValue({}),
    waitForClientWellKnown: jest.fn().mockResolvedValue({}),
    doesServerSupportUnstableFeature: jest.fn().mockResolvedValue(false),
    isVersionSupported: jest.fn().mockResolvedValue(false),
    getVersions: jest.fn().mockResolvedValue({}),
    isFallbackICEServerAllowed: jest.fn(),
    getAuthIssuer: jest.fn().mockRejectedValue(new MatrixError({ errcode: "M_UNKNOWN" }, 404)),
});

export const mockClientMethodsDevice = (
    deviceId = "test-device-id",
): Partial<Record<MethodLikeKeys<MatrixClient>, unknown>> => ({
    getDeviceId: jest.fn().mockReturnValue(deviceId),
    getDevices: jest.fn().mockResolvedValue({ devices: [] }),
});

export const mockClientMethodsCrypto = (): Partial<
    Record<MethodLikeKeys<MatrixClient> & PropertyLikeKeys<MatrixClient>, unknown>
> => ({
    isKeyBackupKeyStored: jest.fn(),
    getCrossSigningCacheCallbacks: jest.fn().mockReturnValue({ getCrossSigningKeyCache: jest.fn() }),
    secretStorage: { hasKey: jest.fn(), isStored: jest.fn().mockResolvedValue(null) },
    getCrypto: jest.fn().mockReturnValue({
        getUserDeviceInfo: jest.fn(),
        getCrossSigningStatus: jest.fn().mockResolvedValue({
            publicKeysOnDevice: true,
            privateKeysInSecretStorage: false,
            privateKeysCachedLocally: {
                masterKey: true,
                selfSigningKey: true,
                userSigningKey: true,
            },
        }),
        isCrossSigningReady: jest.fn().mockResolvedValue(true),
        isSecretStorageReady: jest.fn(),
        getSessionBackupPrivateKey: jest.fn(),
        getVersion: jest.fn().mockReturnValue("Version 0"),
        getOwnDeviceKeys: jest.fn().mockReturnValue(new Promise(() => {})),
        getCrossSigningKeyId: jest.fn(),
        isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(false),
        getKeyBackupInfo: jest.fn().mockResolvedValue(null),
    }),
});

export const mockClientMethodsRooms = (rooms: Room[] = []): Partial<Record<MethodLikeKeys<MatrixClient>, unknown>> => ({
    getRooms: jest.fn().mockReturnValue(rooms),
    getRoom: jest.fn((roomId) => rooms.find((r) => r.roomId === roomId) ?? null),
    isRoomEncrypted: jest.fn(),
});
