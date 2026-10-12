/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    DocumentPreviewApi as IDocumentPreviewApi,
    DocumentPreviewOpener,
} from "@element-hq/element-web-module-api";

import SettingsStore from "../settings/SettingsStore";
import { documentViewerForFile, openDocumentViewerForFile } from "../utils/documentViewer";

export class DocumentPreviewApi implements IDocumentPreviewApi {
    public getPreviewOpener(mimetype: string): DocumentPreviewOpener | null {
        // The viewers sit behind a lab, and the right panel drops their card while it is off.
        if (!SettingsStore.getValue("feature_pdf_viewer")) return null;
        if (!documentViewerForFile({ mimetype })) return null;

        return ({ blob, name }) => openDocumentViewerForFile({ mimetype, name, blob });
    }
}
