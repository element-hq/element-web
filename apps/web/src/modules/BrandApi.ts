/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type BrandApi, type TitleRenderFunction, type TitleRenderOptions } from "@element-hq/element-web-module-api";

export class ElementWebBrandApi implements BrandApi {
    private titleRenderer: TitleRenderFunction | undefined;

    public registerTitleRenderer(renderFunction: TitleRenderFunction): void {
        if (this.titleRenderer) {
            throw new Error("A title renderer has already been registered by another module");
        }
        this.titleRenderer = renderFunction;
    }

    /**
     * Render the window title using the registered renderer, or return undefined
     * to fall back to the default title logic.
     */
    public renderTitle(opts: TitleRenderOptions): string | undefined {
        return this.titleRenderer?.(opts);
    }
}
