/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    DocumentPreviewApi as IDocumentPreviewApi,
    DocumentPreviewFileInfo,
    DocumentPreviewOpener,
} from "@element-hq/element-web-module-api";

import SettingsStore from "../settings/SettingsStore";
import type { SDKContextClass } from "../contexts/SDKContextClass";
import { documentViewerForFile, openDocumentViewerForFile } from "../utils/documentViewer";

export class DocumentPreviewApi implements IDocumentPreviewApi {
    private sdkContext?: SDKContextClass;
    public readonly moduleLoadPromise: Promise<void>;

    public constructor() {
        this.moduleLoadPromise = this.init();
    }

    /**
     * Load the SDK context through a dynamic import. A static import creates an import cycle
     * through the message body components.
     */
    private async init(): Promise<void> {
        const module = await import("../contexts/SDKContextClass");
        this.sdkContext = module.SDKContextClass.instance;
    }

    public getPreviewOpener({ mimetype, name }: DocumentPreviewFileInfo): DocumentPreviewOpener | null {
        // The viewers sit behind a lab, and the right panel drops their card while it is off.
        if (!SettingsStore.getValue("feature_pdf_viewer")) return null;
        if (!documentViewerForFile({ mimetype, name })) return null;

        return ({ blob }) => {
            // The lab may have been turned off since the opener was returned.
            if (!SettingsStore.getValue("feature_pdf_viewer")) {
                throw new Error("Document previews are disabled");
            }
            // The card opens in the viewed room, and the right panel drops it if there is none.
            // If the context has not loaded yet, no room can have been viewed.
            if (!this.sdkContext?.roomViewStore.getRoomId()) {
                throw new Error("No room is being viewed");
            }

            openDocumentViewerForFile({ mimetype, name, blob });
        };
    }
}
