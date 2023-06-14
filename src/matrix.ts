/*
Copyright 2015-2022 The Matrix.org Foundation C.I.C.

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

import { WidgetApi } from "matrix-widget-api";

import { MemoryCryptoStore } from "./crypto/store/memory-crypto-store";
import { MemoryStore } from "./store/memory";
import { MatrixScheduler } from "./scheduler";
import { MatrixClient, ICreateClientOpts } from "./client";
import { RoomWidgetClient, ICapabilities } from "./embedded";
import { CryptoStore } from "./crypto/store/base";

export * from "./client";
export * from "./embedded";
export * from "./http-api";
export * from "./autodiscovery";
export * from "./sync-accumulator";
export * from "./errors";
export * from "./models/beacon";
export * from "./models/event";
export * from "./models/room";
export * from "./models/event-timeline";
export * from "./models/event-timeline-set";
export * from "./models/poll";
export * from "./models/room-member";
export * from "./models/room-state";
export * from "./models/thread";
export * from "./models/typed-event-emitter";
export * from "./models/user";
export * from "./models/device";
export * from "./scheduler";
export * from "./filter";
export * from "./timeline-window";
export * from "./interactive-auth";
export * from "./service-types";
export * from "./store/memory";
export * from "./store/indexeddb";
export * from "./crypto/store/memory-crypto-store";
export * from "./crypto/store/indexeddb-crypto-store";
export type { OutgoingRoomKeyRequest } from "./crypto/store/base";
export * from "./content-repo";
export * from "./@types/event";
export * from "./@types/PushRules";
export * from "./@types/partials";
export * from "./@types/requests";
export * from "./@types/search";
export * from "./models/room-summary";
export * as ContentHelpers from "./content-helpers";
export * as SecretStorage from "./secret-storage";
export type { ICryptoCallbacks } from "./crypto"; // used to be located here
export { createNewMatrixCall } from "./webrtc/call";
export type { MatrixCall } from "./webrtc/call";
export { GroupCallEvent, GroupCallIntent, GroupCallState, GroupCallType } from "./webrtc/groupCall";
export type { GroupCall } from "./webrtc/groupCall";
export { CryptoEvent } from "./crypto";

/**
 * Types supporting cryptography.
 *
 * The most important is {@link Crypto.CryptoApi}, an instance of which can be retrieved via
 * {@link MatrixClient.getCrypto}.
 */
export * as Crypto from "./crypto-api";

/**
 * Backwards compatibility re-export
 * @internal
 * @deprecated use {@link Crypto.CryptoApi}
 */
export type { CryptoApi } from "./crypto-api";

/**
 * Backwards compatibility re-export
 * @internal
 * @deprecated use {@link Crypto.DeviceVerificationStatus}
 */
export { DeviceVerificationStatus } from "./crypto-api";

let cryptoStoreFactory = (): CryptoStore => new MemoryCryptoStore();

/**
 * Configure a different factory to be used for creating crypto stores
 *
 * @param fac - a function which will return a new `CryptoStore`
 */
export function setCryptoStoreFactory(fac: () => CryptoStore): void {
    cryptoStoreFactory = fac;
}

function amendClientOpts(opts: ICreateClientOpts): ICreateClientOpts {
    opts.store =
        opts.store ??
        new MemoryStore({
            localStorage: global.localStorage,
        });
    opts.scheduler = opts.scheduler ?? new MatrixScheduler();
    opts.cryptoStore = opts.cryptoStore ?? cryptoStoreFactory();

    return opts;
}

/**
 * Construct a Matrix Client. Similar to {@link MatrixClient}
 * except that the 'request', 'store' and 'scheduler' dependencies are satisfied.
 * @param opts - The configuration options for this client. These configuration
 * options will be passed directly to {@link MatrixClient}.
 *
 * @returns A new matrix client.
 * @see {@link MatrixClient} for the full list of options for
 * `opts`.
 */
export function createClient(opts: ICreateClientOpts): MatrixClient {
    return new MatrixClient(amendClientOpts(opts));
}

export function createRoomWidgetClient(
    widgetApi: WidgetApi,
    capabilities: ICapabilities,
    roomId: string,
    opts: ICreateClientOpts,
): MatrixClient {
    return new RoomWidgetClient(widgetApi, capabilities, roomId, amendClientOpts(opts));
}
