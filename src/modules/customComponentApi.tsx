/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type CustomComponentTarget,
    type CustomComponentsApi as ICustomComponentsApi,
    type CustomComponentProps,
    type CustomComponentRenderFunction,
} from "@element-hq/element-web-module-api";

import type React from "react";

export class CustomComponentsApi implements ICustomComponentsApi {
    private registeredRenderers = new Map<
        CustomComponentTarget,
        CustomComponentRenderFunction<CustomComponentTarget>[]
    >();

    public register<T extends CustomComponentTarget>(target: T, renderer: CustomComponentRenderFunction<T>): void {
        const renderSet = this.registeredRenderers.get(target);
        if (renderSet) {
            // This type is safe, registeredRenderers maps T => CustomComponentRenderFunction<T>
            renderSet.push(renderer as CustomComponentRenderFunction<CustomComponentTarget>);
        } else {
            this.registeredRenderers.set(target, [renderer as CustomComponentRenderFunction<CustomComponentTarget>]);
        }
    }

    public render<T extends CustomComponentTarget>(
        target: T,
        props: CustomComponentProps[T],
        originalComponent: () => React.JSX.Element,
    ): React.JSX.Element {
        for (const renderer of this.registeredRenderers.get(target) ?? []) {
            const component = renderer(props, originalComponent);
            if (component) {
                return component;
            }
        }
        return originalComponent();
    }
}
