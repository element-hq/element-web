/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { vi } from "vitest";

import type { DriverSnapshot } from "@matrix-widget-tools/widget-host-bindings";

import { type WidgetHostBindings } from "./bindings";
import { type MatrixBackendCodec } from "./JsSdkMatrixBackend";

/**
 * A stand-in for the widget host bindings' error type: the same shape as the generated class, without the
 * wasm module behind it.
 */
export class FakeBackendFailed extends Error {
    public readonly tag = "Failed";

    public constructor(public readonly inner: { errcode?: string; status?: number; reason: string }) {
        super(inner.reason);
    }
}

/**
 * The parts of the bindings the backend needs, without the wasm module.
 */
export function createFakeCodec(): MatrixBackendCodec {
    return {
        BackendError: { Failed: FakeBackendFailed },
        StateKeySelector_Tags: { Any: "Any", Key: "Key" },
        RelationDirection: { Forward: 0, Backward: 1 },
        matrixEventFromJson: (json: string) => {
            const ev = JSON.parse(json);
            return {
                eventType: ev.type,
                sender: ev.sender,
                eventId: ev.event_id,
                roomId: ev.room_id,
                originServerTs: BigInt(ev.origin_server_ts ?? 0),
                stateKey: ev.state_key,
                content: ev.content,
                unsigned: ev.unsigned,
            };
        },
    } as unknown as MatrixBackendCodec;
}

/**
 * A driver whose methods are spies. `handleMessageFromWidget` resolves; tests inspect the calls.
 */
export class FakeWidgetHostDriver {
    public static instances: FakeWidgetHostDriver[] = [];

    public approveCapabilities = vi.fn<(approved: string[]) => void>();
    public setAutoApproved = vi.fn<(capabilities: string[]) => void>();
    public handleMessageFromWidget = vi.fn<(json: string) => Promise<void>>().mockResolvedValue(undefined);
    public uniffiDestroy = vi.fn<() => void>();
    public resolveOpenid = vi.fn<(allowed: boolean) => Promise<void>>().mockResolvedValue(undefined);
    public setOpenidAutoApproved = vi.fn<(autoApproved: boolean) => void>();
    public approved: string[] = [];
    public snapshot = vi.fn<() => DriverSnapshot>(() => ({
        ready: false,
        approved: this.approved,
        pendingRequested: [],
        autoApproved: [],
        pendingOpenidRequests: [],
        openidAutoApproved: false,
    }));

    public constructor(
        public readonly backend: unknown,
        public readonly platform: unknown,
    ) {
        FakeWidgetHostDriver.instances.push(this);
    }
}

/**
 * Fake bindings for `vi.mock("./bindings")`: the codec plus the fake driver.
 */
export function createFakeBindings(): WidgetHostBindings {
    return {
        ...createFakeCodec(),
        uniffiInitAsync: () => Promise.resolve(),
        WidgetHostDriver: FakeWidgetHostDriver,
    } as unknown as WidgetHostBindings;
}
