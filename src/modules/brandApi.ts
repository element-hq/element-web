/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    BrandApi as IBrandApi,
    FaviconRenderFunction,
    FaviconRenderOptions,
    TitleRenderFunction,
    TitleRenderOptions
} from "@element-hq/element-web-module-api";


export class BrandApi implements IBrandApi {
    private registeredFaviconFunction?: FaviconRenderFunction;
    private registeredTitleFunction?: TitleRenderFunction;

    public registerFaviconRenderer(
        func: FaviconRenderFunction
    ): void {
        if (this.registeredFaviconFunction) {
            throw Error('A custom favicon rendering function has already been registered');
        }
        this.registeredFaviconFunction = func;
    }

    public registerTitleRenderer(
        func: TitleRenderFunction
    ): void {
        if (this.registeredTitleFunction) {
            throw Error('A custom title rendering function has already been registered');
        }
        this.registeredTitleFunction = func;
    }

    /**
     * Returns a URL to a rendered favicon if a module has generated one, otherwise
     * this returns undefined.
     * @param opts Options to pass to the render function.
     * @returns A URL string, or undefined.
     */
    public renderFavicon(opts: FaviconRenderOptions): string|undefined {
        return this.registeredFaviconFunction?.(opts);
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
