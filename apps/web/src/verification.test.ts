/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect } from "vitest";
import { createTestClient, TestSDKContext } from "test-utils";

import { verifyUser } from "./verification";
import defaultDispatcher from "./dispatcher/dispatcher";
import DMRoomMap from "./utils/DMRoomMap.ts";
import { RightPanelPhases } from "./stores/right-panel/RightPanelStorePhases.ts";

describe("verifyUser", () => {
    const sdkContext = new TestSDKContext();
    sdkContext._client = createTestClient();
    DMRoomMap.makeShared(sdkContext._client);

    it("should require registration if user is a guest", () => {
        vi.spyOn(defaultDispatcher, "dispatch");
        vi.spyOn(sdkContext._client!, "isGuest").mockReturnValue(true);
        verifyUser(
            sdkContext.rightPanelStore,
            sdkContext.client!,
            sdkContext.client!.getUser(sdkContext.client!.getUserId()!)!,
        );
        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({ action: "require_registration" });
    });

    it("should open verification in right panel", () => {
        vi.spyOn(sdkContext.rightPanelStore, "setCards");
        vi.spyOn(sdkContext._client!, "isGuest").mockReturnValue(false);
        verifyUser(
            sdkContext.rightPanelStore,
            sdkContext.client!,
            sdkContext.client!.getUser(sdkContext.client!.getUserId()!)!,
        );
        expect(sdkContext.rightPanelStore.setCards).toHaveBeenCalledWith([
            { phase: RightPanelPhases.RoomSummary },
            expect.objectContaining({ phase: RightPanelPhases.MemberInfo }),
            expect.objectContaining({ phase: RightPanelPhases.EncryptionPanel }),
        ]);
    });
});
