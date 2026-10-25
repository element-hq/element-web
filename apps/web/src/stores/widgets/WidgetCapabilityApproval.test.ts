/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Widget, WidgetKind } from "matrix-widget-api";

import Modal from "../../Modal";
import { ModuleApi } from "../../modules/Api";
import { approveWidgetCapabilities, getRememberedCapabilitiesForWidget } from "./WidgetCapabilityApproval";

describe("approveWidgetCapabilities", () => {
    const widget = new Widget({
        id: "test",
        creatorUserId: "@alice:example.org",
        type: "example",
        url: "https://example.org",
    });
    const baseOpts = { widget, widgetKind: WidgetKind.Room, roomId: "!1:example.org" };
    const send = "org.matrix.msc2762.send.event:m.room.message";
    const receive = "org.matrix.msc2762.receive.event:m.room.message";

    let createDialog: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        localStorage.clear();
        createDialog = vi.spyOn(Modal, "createDialog").mockImplementation(() => {
            throw new Error("Should not have to create a dialog");
        });
        vi.spyOn(ModuleApi.instance.widgetLifecycle, "preapproveCapabilities").mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("grants pre-approved capabilities without prompting", async () => {
        const approved = await approveWidgetCapabilities({
            ...baseOpts,
            requested: new Set([send]),
            preApproved: new Set([send, receive]),
        });
        expect(approved).toEqual(new Set([send]));
        expect(createDialog).not.toHaveBeenCalled();
    });

    it("grants remembered capabilities without prompting", async () => {
        localStorage.setItem("widget_test_approved_caps", JSON.stringify([send]));
        const approved = await approveWidgetCapabilities({
            ...baseOpts,
            requested: new Set([send]),
            preApproved: new Set(),
        });
        expect(approved).toEqual(new Set([send]));
        expect(createDialog).not.toHaveBeenCalled();
    });

    it("grants capabilities approved by the module API without prompting", async () => {
        vi.mocked(ModuleApi.instance.widgetLifecycle.preapproveCapabilities).mockResolvedValue(new Set([send]));
        const approved = await approveWidgetCapabilities({
            ...baseOpts,
            requested: new Set([send]),
            preApproved: new Set(),
        });
        expect(approved).toEqual(new Set([send]));
        expect(createDialog).not.toHaveBeenCalled();
    });

    it("prompts for the remaining capabilities and remembers the choice", async () => {
        createDialog.mockReturnValue({
            finished: Promise.resolve([{ approved: [receive], remember: true }]),
        } as unknown as ReturnType<typeof Modal.createDialog>);

        const approved = await approveWidgetCapabilities({
            ...baseOpts,
            requested: new Set([send, receive]),
            preApproved: new Set([send]),
        });

        expect(createDialog).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ requestedCapabilities: new Set([receive]), widgetKind: WidgetKind.Room }),
        );
        expect(approved).toEqual(new Set([send, receive]));
        expect(getRememberedCapabilitiesForWidget(widget)).toEqual([send, receive]);
    });

    it("denies what the user did not approve and keeps nothing remembered", async () => {
        createDialog.mockReturnValue({
            finished: Promise.resolve([{ approved: [], remember: false }]),
        } as unknown as ReturnType<typeof Modal.createDialog>);

        const approved = await approveWidgetCapabilities({
            ...baseOpts,
            requested: new Set([receive]),
            preApproved: new Set(),
        });

        expect(approved).toEqual(new Set());
        expect(getRememberedCapabilitiesForWidget(widget)).toEqual([]);
    });

    it("treats a failing prompt as a denial", async () => {
        createDialog.mockReturnValue({
            finished: Promise.reject(new Error("closed")),
        } as unknown as ReturnType<typeof Modal.createDialog>);

        const approved = await approveWidgetCapabilities({
            ...baseOpts,
            requested: new Set([send, receive]),
            preApproved: new Set([send]),
        });

        expect(approved).toEqual(new Set([send]));
    });
});
