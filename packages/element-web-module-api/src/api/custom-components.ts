/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { JSX } from "react";
import type { MatrixEvent } from "matrix-js-sdk/lib/matrix";

/**
 * Properties for all message components.
 * @alpha Subject to change.
 */
export type CustomMessageComponentProps = {
    /**
     * The Matrix event for this textual body.
     */
    mxEvent: MatrixEvent;
};

/**
 * Properties to alter the render function of the original component.
 * @alpha Subject to change.
 */
export type OriginalComponentProps = {
    /**
     * Should previews be shown for this event.
     * This may be overriden by user preferences.
     */
    showUrlPreview?: boolean;
};

/**
 * Function used to render a message component.
 * @beta Unlikely to change
 */
export type CustomMessageRenderFunction = (
    /**
     * Properties for the message to be renderered.
     */
    props: CustomMessageComponentProps,
    /**
     * Render function for the original component. This may be omitted if the message would not normally be rendered.
     */
    originalComponent?: (props?: OriginalComponentProps) => React.JSX.Element,
) => JSX.Element | null;

/**
 * API for inserting custom components into Element.
 * @public
 */
export interface CustomComponentsApi {
    /**
     * Register a renderer for a message type in the timeline.
     *
     * The render function should either return a rendered component, or `null` if the
     * component should not be overidden (for instance, to passthrough to another module or allow
     * the application complete control)
     *
     * Multiple render function may be registered for a single target, however the first
     * non-null result will be used. If all results are null, or no registrations exist
     * for a target then the original component is used.
     *
     * @param eventType - The event type this renderer is for. Use a RegExp instance if you want to target multiple types.
     * @param renderer - The render function.
     * @example
     * ```
     *  customComponents.registerMessageRenderer("m.room.message", (props, originalComponent) => {
     *       return <YourCustomComponent mxEvent={props.mxEvent} />;
     *  });
     *  customComponents.registerMessageRenderer(/m\.room\.(topic|name)/, (props, originalComponent) => {
     *       if (props.mxEvent.isState()) {
     *           return <YourCustomStateRenderer mxEvent={props.mxEvent} />;
     *       }
     *       // Passthrough.
     *       return null;
     *  });
     * ```
     */
    registerMessageRenderer(eventType: string | RegExp, renderer: CustomMessageRenderFunction): void;
}
