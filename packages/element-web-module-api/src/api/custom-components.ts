/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { JSX } from "react";
import type { MatrixEvent } from "matrix-js-sdk";

/**
 * Targets in Element for custom components.
 * @public
 */
export enum CustomComponentTarget {
    /**
     * Component that renders "m.room.message" events in the room timeline.
     */
    TextualBody = "TextualBody",
}

/**
 * Properties for the render component.
 * @public
 */
export type CustomComponentProps = {
    [CustomComponentTarget.TextualBody]: {
        /**
         * The Matrix event for this textual body.
         */
        mxEvent: MatrixEvent;
        /**
         * Words to highlight on (e.g. from search results).
         * May be undefined if the client does not need to highlight
         */
        highlights?: string[];
        /**
         * Should previews be shown for this event
         */
        showUrlPreview?: boolean;
        /**
         * Is this event being rendered to a static export
         */
        forExport?: boolean;
    };
};
/**
 * Render function. Returning null skips this function and passes it onto the next registered renderer.
 * @public
 */
export type CustomComponentRenderFunction<T extends CustomComponentTarget> = (
    /**
     * Properties from the given target to be used for rendering.
     */
    props: CustomComponentProps[T],
    /**
     * Render function for the original component.
     */
    originalComponent: () => JSX.Element,
) => JSX.Element | null;

/**
 * API for inserting custom components into Element.
 * @public
 */
export interface CustomComponentsApi {
    /**
     * Register a renderer for a component type.
     * The render function should either return a rendered component, or `null` if the
     * component should not be overidden.
     *
     * Multiple render function may be registered for a single target, however the first
     * non-null result will be used. If all results are null, or no registrations exist
     * for a target then the original component is used.
     *
     * @param target - The target location for the component.
     * @param renderer - The render method.
     */
    register<T extends CustomComponentTarget>(target: T, renderer: CustomComponentRenderFunction<T>): void;
}
