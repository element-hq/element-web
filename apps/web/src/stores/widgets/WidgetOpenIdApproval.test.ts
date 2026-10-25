/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Widget, WidgetKind } from "matrix-widget-api";

import Modal from "../../Modal";
import { SDKContextClass } from "../../contexts/SDKContextClass";
import { ModuleApi } from "../../modules/Api";
import { approveWidgetOpenId } from "./WidgetOpenIdApproval";
import { OIDCState } from "./WidgetPermissionStore";

describe("approveWidgetOpenId", () => {
    const widget = new Widget({
        id: "test",
        creatorUserId: "@alice:example.org",
        type: "example",
        url: "https://example.org",
    });
    const opts = { widget, widgetKind: WidgetKind.Room, roomId: "!1:example.org" };

    let createDialog: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        createDialog = vi.spyOn(Modal, "createDialog").mockImplementation(() => {
            throw new Error("Should not have to create a dialog");
        });
        vi.spyOn(ModuleApi.instance.widgetLifecycle, "preapproveIdentity").mockResolvedValue(false);
        vi.spyOn(SDKContextClass.instance.widgetPermissionStore, "getOIDCState").mockReturnValue(OIDCState.Unknown);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("allows when the module API approves", async () => {
        vi.mocked(ModuleApi.instance.widgetLifecycle.preapproveIdentity).mockResolvedValue(true);
        await expect(approveWidgetOpenId(opts)).resolves.toBe(true);
        expect(createDialog).not.toHaveBeenCalled();
    });

    it("follows the remembered decision without prompting", async () => {
        const getOIDCState = vi.mocked(SDKContextClass.instance.widgetPermissionStore.getOIDCState);
        getOIDCState.mockReturnValue(OIDCState.Allowed);
        await expect(approveWidgetOpenId(opts)).resolves.toBe(true);
        getOIDCState.mockReturnValue(OIDCState.Denied);
        await expect(approveWidgetOpenId(opts)).resolves.toBe(false);
        expect(createDialog).not.toHaveBeenCalled();
    });

    it("prompts otherwise and reports the answer", async () => {
        const onPrompt = vi.fn();
        createDialog.mockReturnValue({ finished: Promise.resolve([true]) } as unknown as ReturnType<
            typeof Modal.createDialog
        >);
        await expect(approveWidgetOpenId({ ...opts, onPrompt })).resolves.toBe(true);
        expect(onPrompt).toHaveBeenCalledTimes(1);
        expect(createDialog).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ widget, widgetKind: WidgetKind.Room, inRoomId: "!1:example.org" }),
        );

        createDialog.mockReturnValue({ finished: Promise.resolve([undefined]) } as unknown as ReturnType<
            typeof Modal.createDialog
        >);
        await expect(approveWidgetOpenId(opts)).resolves.toBe(false);
    });
});
