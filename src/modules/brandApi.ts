/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    BrandApi as IBrandApi,
    TitleRenderFunction,
    TitleRenderOptions
} from "@element-hq/element-web-module-api";


export class BrandApi implements IBrandApi {
    private registeredTitleFunction?: TitleRenderFunction;

    public registerTitleRenderer(
        func: TitleRenderFunction
    ): void {
        if (this.registeredTitleFunction) {
            throw Error('A custom title rendering function has already been registered');
        }
        this.registeredTitleFunction = func;
    }

    /**
     * Returns the title text if a module has generated one, otherwise
     * this returns undefined.
     * @param opts Options to pass to the render function.
     * @returns Title text, or undefined.
     */
    public renderTitle(opts: TitleRenderOptions): string|undefined {
        return this.registeredTitleFunction?.(opts);
    }
}
