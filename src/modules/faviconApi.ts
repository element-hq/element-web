/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    FaviconApi as IFaviconApi,
    FaviconRenderFunction,
    FaviconRenderOptions
} from "@element-hq/element-web-module-api";


export class FaviconApi implements IFaviconApi {
    private registeredFunction?: FaviconRenderFunction;

    public registerRenderer(
        func: FaviconRenderFunction
    ): void {
        if (this.registeredFunction) {
            throw Error('A custom favicon rendering function has already been registered');
        }
        this.registeredFunction = func;
    }

    /**
     * Returns a URL to a rendered favicon if a module has generated one, otherwise
     * this returns undefined.
     * @param opts Options to pass to the render function.
     * @returns A URL string, or undefined.
     */
    public renderFavicon(opts: FaviconRenderOptions): string|undefined {
        return this.registeredFunction?.(opts);
    }
}
