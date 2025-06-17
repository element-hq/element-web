/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import type {
    CustomComponentsApi as ICustomComponentsApi,
    CustomMessageRenderFunction,
    CustomMessageComponentProps as ModuleCustomMessageComponentProps,
    OriginalComponentProps,
    CustomMessageRenderHints,
} from "@element-hq/element-web-module-api";
import type React from "react";

// element-modules uses the compiled MatrixEvent interface from matrix-js-sdk
// whereas element-web uses MatrixEvent from the source. Due to the private
// fields conflicting, this type is used to stip MatrixEvent down to the public
// fields only which should match.
type MatrixEventPublic = Pick<MatrixEvent, keyof MatrixEvent>;

type EventRenderer = {
    eventTypeOrFilter: string | ((mxEvent: MatrixEventPublic) => boolean);
    renderer: CustomMessageRenderFunction;
    hints: CustomMessageRenderHints;
};

// As per MatrixEventPublic, this type overrides `ModuleCustomMessageComponentProps` to use
// our stripped type.
interface CustomMessageComponentProps extends Omit<ModuleCustomMessageComponentProps, "mxEvent"> {
    mxEvent: MatrixEventPublic;
}

export class CustomComponentsApi implements ICustomComponentsApi {
    private readonly registeredMessageRenderers: EventRenderer[] = [];

    public registerMessageRenderer(
        eventTypeOrFilter: string | ((mxEvent: MatrixEventPublic) => boolean),
        renderer: CustomMessageRenderFunction,
        hints: CustomMessageRenderHints = {},
    ): void {
        this.registeredMessageRenderers.push({ eventTypeOrFilter: eventTypeOrFilter, renderer, hints });
    }
    /**
     * Select the correct renderer based on the event information.
     * @param mxEvent The message event being rendered.
     * @returns The registered renderer.
     */
    private selectRenderer(mxEvent: MatrixEventPublic): EventRenderer | undefined {
        return this.registeredMessageRenderers.find((rdr) => {
            if (typeof rdr.eventTypeOrFilter === "string") {
                return rdr.eventTypeOrFilter === mxEvent.getType();
            } else {
                try {
                    return rdr.eventTypeOrFilter(mxEvent);
                } catch (ex) {
                    logger.warn("Message renderer failed to process filter", ex);
                    return false; // Skip erroring renderers.
                }
            }
        });
    }

    /**
     * Render the component for a message event.
     * @param props Props to be passed to the custom renderer.
     * @param originalComponent Function that will be rendered if no custom renderers are present, or as a child of a custom component.
     * @returns A component if a custom renderer exists, or originalComponent returns a value. Otherwise null.
     */
    public renderMessage(
        props: CustomMessageComponentProps,
        originalComponent?: (props?: OriginalComponentProps) => React.JSX.Element,
    ): React.JSX.Element | null {
        const renderer = this.selectRenderer(props.mxEvent);
        if (renderer) {
            try {
                return renderer.renderer(props as ModuleCustomMessageComponentProps, originalComponent);
            } catch (ex) {
                logger.warn("Message renderer failed to render", ex);
                // Fall through to original component. If the module encounters an error we still want to display messages to the user!
            }
        }
        return originalComponent?.() || null;
    }

    /**
     * Get hints about an message before rendering it.
     * @param mxEvent The message event being rendered.
     * @returns A component if a custom renderer exists, or originalComponent returns a value. Otherwise null.
     */
    public getHintsForMessage(mxEvent: MatrixEventPublic): CustomMessageRenderHints {
        const renderer = this.selectRenderer(mxEvent);
        if (renderer) {
            return renderer.hints;
        }
        return {};
    }
}
