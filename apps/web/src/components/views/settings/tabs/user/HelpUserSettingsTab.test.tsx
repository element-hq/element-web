/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "test-utils-rtl";
import { getMockClientWithEventEmitter, mockClientMethodsUser, mockClientMethodsServer } from "test-utils";

import HelpUserSettingsTab from "./HelpUserSettingsTab";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import { ElementWebExtrasApi } from "../../../../../modules/ExtrasApi";
import type { ModuleApi } from "../../../../../modules/Api";

describe("<HelpUserSettingsTab />", () => {
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(),
        ...mockClientMethodsServer(),
        getCrypto: vi.fn(),
        getHomeserverUrl: vi.fn().mockReturnValue("https://server.org"),
        getIdentityServerUrl: vi.fn(),
        getAccessToken: vi.fn().mockReturnValue("token"),
    });

    const getComponent = (extras: ElementWebExtrasApi) =>
        render(<HelpUserSettingsTab moduleApi={{ extras } as unknown as ModuleApi} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
            ),
        });

    it("renders credits attributions registered by modules", () => {
        const extras = new ElementWebExtrasApi();
        extras.setCreditsAttribution("first", () => <>First module credit</>);
        extras.setCreditsAttribution("second", () => <>Second module credit</>);
        getComponent(extras);

        const items = within(screen.getByRole("list")).getAllByRole("listitem");
        // The three built-in credits come first, followed by module attributions in registration order.
        expect(items).toHaveLength(5);
        expect(items[3]).toHaveTextContent("First module credit");
        expect(items[4]).toHaveTextContent("Second module credit");
    });
});
