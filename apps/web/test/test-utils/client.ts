/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { type MockedObject } from "vitest";
import { type MethodLikeKeys, type PropertyLikeKeys } from "jest-mock";
import { type MockedObjectDeep } from "@vitest/spy";
import { Feature, ServerSupport } from "matrix-js-sdk/src/feature";
import { type MatrixClient, type Room, User } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { vi } from "../setup/adapter.ts";

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
        getUserId: vi.fn().mockReturnValue(aliceId),
    });
 * ```
 *
 * See also {@link stubClient} which does something similar but uses a more complete mock client.
 */
export const getMockClientWithEventEmitter = (
    mockProperties: Partial<Record<keyof MatrixClient, unknown>>,
): MockedObject<MatrixClient> => {
    const mock = vi.mocked(new MockClientWithEventEmitter(mockProperties) as unknown as MatrixClient);

    vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mock);
    vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mock);

    // @ts-ignore simplified test stub
    mock.canSupport = new Map();
    Object.keys(Feature).forEach((feature) => {
        mock.canSupport.set(feature as Feature, ServerSupport.Stable);
    });
    return mock;
};

export const unmockClientPeg = () => {
    vi.spyOn(MatrixClientPeg, "get").mockRestore();
    vi.spyOn(MatrixClientPeg, "safeGet").mockRestore();
};

/**
 * Returns basic mocked client methods related to the current user
 * ```
 * const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser('@mytestuser:domain'),
    });
 * ```
 */
export const mockClientMethodsUser = (userId = "@alice:domain") =>
    ({
        getUserId: vi.fn().mockReturnValue(userId),
        getDomain: vi.fn().mockReturnValue(userId.split(":")[1]),
        getSafeUserId: vi.fn().mockReturnValue(userId),
        getUser: vi.fn().mockReturnValue(new User(userId)),
        isGuest: vi.fn().mockReturnValue(false),
        mxcUrlToHttp: vi.fn().mockReturnValue("mock-mxcUrlToHttp"),
        credentials: { userId },
        getThreePids: vi.fn().mockResolvedValue({ threepids: [] }),
        getAccessToken: vi.fn(),
        getDeviceId: vi.fn(),
        getAccountData: vi.fn(),
    }) satisfies MockedObjectDeep<any>;

/**
 * Returns basic mocked client methods related to rendering events
 * ```
 * const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser('@mytestuser:domain'),
    });
 * ```
 */
export const mockClientMethodsEvents = () =>
    ({
        decryptEventIfNeeded: vi.fn(),
        getPushActionsForEvent: vi.fn(),
    }) satisfies MockedObjectDeep<any>;

/**
 * Returns basic mocked pushProcessor
 */
export const mockClientPushProcessor = () =>
    ({
        pushProcessor: {
            getPushRuleById: vi.fn(),
            ruleMatchesEvent: vi.fn(),
        },
    }) satisfies MockedObjectDeep<any>;

/**
 * Returns basic mocked client methods related to server support
 */
export const mockClientMethodsServer = (): Partial<Record<MethodLikeKeys<MatrixClient>, unknown>> => ({
    getIdentityServerUrl: vi.fn(),
    getHomeserverUrl: vi.fn(),
    getCapabilities: vi.fn().mockResolvedValue({}),
    getCachedCapabilities: vi.fn().mockResolvedValue({}),
    getClientWellKnown: vi.fn().mockReturnValue({}),
    waitForClientWellKnown: vi.fn().mockResolvedValue({}),
    doesServerSupportUnstableFeature: vi.fn().mockResolvedValue(false),
    isVersionSupported: vi.fn().mockResolvedValue(false),
    getVersions: vi.fn().mockResolvedValue({}),
    isFallbackICEServerAllowed: vi.fn(),
});

export const mockClientMethodsDevice = (
    deviceId = "test-device-id",
): Partial<Record<MethodLikeKeys<MatrixClient>, unknown>> => ({
    getDeviceId: vi.fn().mockReturnValue(deviceId),
    getDevices: vi.fn().mockResolvedValue({ devices: [] }),
});

export const mockClientMethodsCrypto = (): Partial<
    Record<MethodLikeKeys<MatrixClient> & PropertyLikeKeys<MatrixClient>, unknown>
> => ({
    isKeyBackupKeyStored: vi.fn(),
    getCrossSigningCacheCallbacks: vi.fn().mockReturnValue({ getCrossSigningKeyCache: vi.fn() }),
    secretStorage: {
        hasKey: vi.fn(),
        isStored: vi.fn().mockResolvedValue(null),
        getDefaultKeyId: vi.fn().mockResolvedValue(null),
    },
    getCrypto: vi.fn().mockReturnValue({
        getUserDeviceInfo: vi.fn(),
        getDeviceVerificationStatus: vi.fn().mockResolvedValue(null),
        getCrossSigningStatus: vi.fn().mockResolvedValue({
            publicKeysOnDevice: true,
            privateKeysInSecretStorage: false,
            privateKeysCachedLocally: {
                masterKey: true,
                selfSigningKey: true,
                userSigningKey: true,
            },
        }),
        isCrossSigningReady: vi.fn().mockResolvedValue(true),
        isSecretStorageReady: vi.fn(),
        getSessionBackupPrivateKey: vi.fn(),
        getVersion: vi.fn().mockReturnValue("Version 0"),
        getOwnDeviceKeys: vi.fn().mockReturnValue(new Promise(() => {})),
        getCrossSigningKeyId: vi.fn(),
        isEncryptionEnabledInRoom: vi.fn().mockResolvedValue(false),
        getKeyBackupInfo: vi.fn().mockResolvedValue(null),
    }),
});

export const mockClientMethodsRooms = (rooms: Room[] = []): Partial<Record<MethodLikeKeys<MatrixClient>, unknown>> => ({
    getRooms: vi.fn().mockReturnValue(rooms),
    getRoom: vi.fn((roomId) => rooms.find((r) => r.roomId === roomId) ?? null),
    isRoomEncrypted: vi.fn(),
});
