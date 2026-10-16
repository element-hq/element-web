/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentPreviewApi } from "./DocumentPreviewApi";
import SettingsStore from "../settings/SettingsStore";
import { SettingLevel } from "../settings/SettingLevel";
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { SDKContextClass } from "../contexts/SDKContextClass";

/** The viewers sit behind a lab, so there is nothing to open with while it is off. */
const setDocumentPreviewsLab = (enabled: boolean): Promise<void> =>
    SettingsStore.setValue("feature_pdf_viewer", null, SettingLevel.DEVICE, enabled);

describe("DocumentPreviewApi", () => {
    beforeEach(async () => {
        await setDocumentPreviewsLab(true);
    });

    afterEach(() => {
        SettingsStore.reset();
        vi.restoreAllMocks();
    });

    it.each(["application/pdf", "text/markdown"])("offers an opener for %s", (mimetype) => {
        expect(new DocumentPreviewApi().getPreviewOpener({ mimetype })).toBeInstanceOf(Function);
    });

    it("offers an opener for a Markdown file with a generic mimetype, going by its name", () => {
        const openPreview = new DocumentPreviewApi().getPreviewOpener({ mimetype: "text/plain", name: "README.md" });

        expect(openPreview).toBeInstanceOf(Function);
    });

    it("returns null for a mimetype no viewer can open", () => {
        expect(new DocumentPreviewApi().getPreviewOpener({ mimetype: "image/png" })).toBeNull();
    });

    it("returns null while the document previews lab is off", async () => {
        await setDocumentPreviewsLab(false);

        expect(new DocumentPreviewApi().getPreviewOpener({ mimetype: "application/pdf" })).toBeNull();
    });

    it("opens the file in the document viewer with the mimetype and name it was got for", () => {
        vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room:example.org");
        const dispatch = vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        const blob = vi.fn(() => Promise.resolve(new Blob()));

        new DocumentPreviewApi().getPreviewOpener({ mimetype: "application/pdf", name: "spec.pdf" })!({ blob });

        expect(dispatch).toHaveBeenCalledWith({
            action: Action.OpenDocumentViewer,
            file: { mimetype: "application/pdf", name: "spec.pdf", blob },
        });
        // Not fetched until the viewer asks for it.
        expect(blob).not.toHaveBeenCalled();
    });

    it("throws if the lab is turned off after the opener was got", async () => {
        vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue("!room:example.org");
        const dispatch = vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        const openPreview = new DocumentPreviewApi().getPreviewOpener({ mimetype: "application/pdf" })!;

        await setDocumentPreviewsLab(false);

        expect(() => openPreview({ blob: vi.fn() })).toThrow("Document previews are disabled");
        expect(dispatch).not.toHaveBeenCalled();
    });

    it("throws if no room is being viewed", () => {
        vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(null);
        const dispatch = vi.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        const openPreview = new DocumentPreviewApi().getPreviewOpener({ mimetype: "application/pdf" })!;

        expect(() => openPreview({ blob: vi.fn() })).toThrow("No room is being viewed");
        expect(dispatch).not.toHaveBeenCalled();
    });
});
