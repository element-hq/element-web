/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { UIComponent, CustomisationsApi as ICustomisationsApi } from "@element-hq/element-web-module-api";

export class CustomisationsApi implements ICustomisationsApi {
    private shouldShowComponentFunctions = new Set<(component: UIComponent) => boolean | void>();

    /**
     * Method to register a callback which can affect whether a given component is drawn or not.
     * @param fn - the callback, if it returns true the component will be rendered, if false it will not be.
     *   If undefined will defer to next callback, ultimately falling through to `true` if none return false.
     */
    public registerShouldShowComponent(fn: (this: void, component: UIComponent) => boolean | void): void {
        this.shouldShowComponentFunctions.add(fn);
    }

    /**
     * Method to check whether, according to any registered modules, a given component should be rendered.
     * @param component - the component to check
     */
    public shouldShowComponent(component: UIComponent): boolean | void {
        for (const fn of this.shouldShowComponentFunctions) {
            const v = fn(component);
            if (typeof v === "boolean") {
                return v;
            }
        }
    }
}
