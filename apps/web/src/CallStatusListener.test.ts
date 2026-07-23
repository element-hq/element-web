/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { EventEmitter } from "events";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

import { CallStatusListener } from "./CallStatusListener";
import { type Call } from "./models/Call";
import SettingsStore from "./settings/SettingsStore";
import { CallStoreEvent, type CallStore } from "./stores/CallStore";
import * as userStatus from "./utils/userStatus";

describe("CallStatusListener", () => {
    let listener: CallStatusListener;
    let callStore: CallStore & EventEmitter;
    let matrixClient: MatrixClient;
    let setUserOnCallSpy: ReturnType<typeof vi.spyOn>;

    const emitConnectedCalls = (newValue: Set<Call>, oldValue: Set<Call>): void => {
        callStore.emit(CallStoreEvent.ConnectedCalls, newValue, oldValue);
    };

    beforeEach(() => {
        listener = new CallStatusListener();
        callStore = new EventEmitter() as unknown as CallStore & EventEmitter;
        matrixClient = {} as MatrixClient;

        setUserOnCallSpy = vi.spyOn(userStatus, "setUserOnCall").mockResolvedValue(undefined);
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(true);
    });

    afterEach(() => {
        listener.stop();
        vi.restoreAllMocks();
    });

    it("sets the user on-a-call status when the user joins a call", () => {
        listener.start(callStore, matrixClient);

        emitConnectedCalls(new Set([{} as Call]), new Set());

        expect(setUserOnCallSpy).toHaveBeenCalledExactlyOnceWith(matrixClient, true);
    });

    it("clears the user on-a-call status when the user leaves their last call", () => {
        listener.start(callStore, matrixClient);

        emitConnectedCalls(new Set(), new Set([{} as Call]));

        expect(setUserOnCallSpy).toHaveBeenCalledExactlyOnceWith(matrixClient, false);
    });

    it("does nothing when the number of connected calls changes but stays non-zero", () => {
        listener.start(callStore, matrixClient);

        emitConnectedCalls(new Set([{} as Call, {} as Call]), new Set([{} as Call]));

        expect(setUserOnCallSpy).not.toHaveBeenCalled();
    });

    it("does nothing when the feature flag is disabled", () => {
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        listener.start(callStore, matrixClient);

        emitConnectedCalls(new Set([{} as Call]), new Set());

        expect(setUserOnCallSpy).not.toHaveBeenCalled();
    });
});
