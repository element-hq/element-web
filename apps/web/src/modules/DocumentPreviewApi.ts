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
import { SDKContextClass } from "../contexts/SDKContextClass";
import { documentViewerForFile, openDocumentViewerForFile } from "../utils/documentViewer";

export class DocumentPreviewApi implements IDocumentPreviewApi {
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
            if (!SDKContextClass.instance.roomViewStore.getRoomId()) {
                throw new Error("No room is being viewed");
            }

            openDocumentViewerForFile({ mimetype, name, blob });
        };
    }
}
