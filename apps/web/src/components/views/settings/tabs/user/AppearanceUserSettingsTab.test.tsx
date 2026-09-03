/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render } from "test-utils-rtl";
import { withClientContextRenderOptions, stubClient } from "test-utils";

import AppearanceUserSettingsTab from "./AppearanceUserSettingsTab";

describe("AppearanceUserSettingsTab", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = stubClient();
        // happy-dom implements matchMedia with real OS-preference-derived results, unlike jsdom which
        // has no implementation at all. Stub it out so system-theme support detection is deterministic.
        vi.stubGlobal(
            "matchMedia",
            vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should render", () => {
        const { asFragment } = render(<AppearanceUserSettingsTab />, withClientContextRenderOptions(client));
        expect(asFragment()).toMatchSnapshot();
    });
});
