/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type {
    CustomComponentsApi as ICustomComponentsApi,
    CustomMessageRenderFunction,
    CustomMessageComponentProps,
} from "@element-hq/element-web-module-api";
import type React from "react";

export class CustomComponentsApi implements ICustomComponentsApi {
    private readonly registeredMessageRenderers: {
        eventType: string | RegExp;
        renderer: CustomMessageRenderFunction;
    }[] = [];

    public registerMessageRenderer(eventType: string | RegExp, renderer: CustomMessageRenderFunction): void {
        this.registeredMessageRenderers.push({ eventType, renderer });
    }

    /**
     * Render the component for a message event.
     * @param props Props to be passed to the custom renderer.
     * @param originalComponent Function that will be rendered if no custom renderers are present, or as a child of a custom component.
     * @returns A component if a custom renderer exists, or originalComponent returns a value. Otherwise null.
     */
    public renderMessage(
        props: CustomMessageComponentProps,
        originalComponent?: () => React.JSX.Element,
    ): React.JSX.Element | null {
        for (const renderer of this.registeredMessageRenderers.filter((e) =>
            props.mxEvent.getType().match(e.eventType),
        ) ?? []) {
            const component = renderer.renderer(props, originalComponent);
            if (component) {
                return component;
            }
        }
        return originalComponent?.() || null;
    }
}
