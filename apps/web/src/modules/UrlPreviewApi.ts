/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { UrlPreviewHandler, UrlPreviewApi as IUrlPreviewApi } from "@element-hq/element-web-module-api";
import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { UrlPreview } from "shared-types";

import { getModuleMatrixEvent } from "./models/Event";

export class UrlPreviewApi implements IUrlPreviewApi {
    private readonly handlers = new Map<RegExp, UrlPreviewHandler>();
    public registerPreviewHandler(regex: RegExp, handler: UrlPreviewHandler): void {
        this.handlers.set(regex, handler);
    }
    public async getPreview(url: string, mxEvent?: MatrixEvent): Promise<UrlPreview | null> {
        for (const [regex, handler] of this.handlers) {
            // If the regex matches, we skip other handler regardless of the outcome.
            if (url.toString().match(regex)) {
                const moduleEv = (mxEvent && getModuleMatrixEvent(mxEvent)) || undefined;
                return await handler(url, moduleEv);
            }
        }
        return null;
    }
}
