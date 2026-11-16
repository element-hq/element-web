/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, expectTypeOf, test } from "vitest";

import type { ClientApi, IncomingToDeviceMessage, OutgoingToDeviceMessage, ToDeviceApi } from "..";
import { type Api, isModule } from ".";

const TestModule = {
    default: class TestModule {
        public static moduleApiVersion = "1.0.0";
        public constructor(private readonly api: Api) {}
        public async load(): Promise<void> {}
    },
};

test("isModule correctly identifies valid modules", () => {
    expect(isModule(TestModule)).toBe(true);
});

test("to-device transport exposes independent send and receive operations", () => {
    expectTypeOf<ClientApi["toDevice"]>().toEqualTypeOf<ToDeviceApi>();
    expectTypeOf<ToDeviceApi["sendMessage"]>().toEqualTypeOf<(message: OutgoingToDeviceMessage) => Promise<void>>();
    expectTypeOf<ToDeviceApi["onMessage"]>().toEqualTypeOf<
        (type: string, listener: (message: IncomingToDeviceMessage) => void) => () => void
    >();
    expectTypeOf<"request" extends keyof ToDeviceApi ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<"send" extends keyof ToDeviceApi ? true : false>().toEqualTypeOf<false>();
});
