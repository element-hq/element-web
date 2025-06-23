/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { JSX } from "react";
import type { MatrixEvent } from "../models/event";

/**
 * Properties for all message components.
 * @alpha Subject to change.
 */
export type CustomMessageComponentProps = {
    /**
     * The Matrix event for this textual body.
     * @alpha
     */
    mxEvent: MatrixEvent;
};

/**
 * Properties to alter the render function of the original component.
 * @alpha Subject to change.
 */
export type OriginalMessageComponentProps = {
    /**
     * Should previews be shown for this event.
     * This may be overriden by user preferences.
     */
    showUrlPreview?: boolean;
};

/**
 * Hints to specify to Element when rendering events.
 * @alpha Subject to change.
 */
export type CustomMessageRenderHints = {
    /**
     * Should the event be allowed to be edited in the client. This should
     * be set to false if you override the render function, as the module
     * API has no way to display message editing at the moment.
     * Default is true.
     */
    allowEditingEvent?: boolean;
};

/**
 * Function used to render a message component.
 * @alpha Subject to change.
 */
export type CustomMessageRenderFunction = (
    /**
     * Properties for the message to be renderered.
     */
    props: CustomMessageComponentProps,
    /**
     * Render function for the original component. This may be omitted if the message would not normally be rendered.
     */
    originalComponent?: (props?: OriginalMessageComponentProps) => React.JSX.Element,
) => JSX.Element;

/**
 * Properties for all message components.
 * @alpha Subject to change.
 */
export type CustomRoomPreviewBarComponentProps = {
    roomId?: string;
    roomAlias?: string;
};

/**
 * Function used to render a room preview bar component.
 * @alpha Unlikely to change
 */
export type CustomRoomPreviewBarRenderFunction = (
    /**
     * Properties for the room preview bar to be rendered.
     */
    props: CustomRoomPreviewBarComponentProps,
    /**
     * Render function for the original component.
     */
    originalComponent: (props: CustomRoomPreviewBarComponentProps) => JSX.Element,
) => JSX.Element;

/**
 * API for inserting custom components into Element.
 * @alpha Subject to change.
 */
export interface CustomComponentsApi {
    /**
     * Register a renderer for a message type in the timeline.
     *
     * The render function should return a rendered component.
     *
     * Multiple render function may be registered for a single event type, however the first matching
     * result will be used. If no events match or are registered then the originalComponent is rendered.
     *
     * @param eventTypeOrFilter - The event type this renderer is for. Use a function for more complex filtering.
     * @param renderer - The render function.
     * @param hints - Hints that alter the way the tile is handled.
     * @example
     * ```
     *  customComponents.registerMessageRenderer("m.room.message", (props, originalComponent) => {
     *       return <YourCustomComponent mxEvent={props.mxEvent} />;
     *  });
     *  customComponents.registerMessageRenderer(
     *      (mxEvent) => mxEvent.getType().matches(/m\.room\.(topic|name)/) && mxEvent.isState(),
     *      (props, originalComponent) => {
     *          return <YourCustomStateRenderer mxEvent={props.mxEvent} />;
     *      }
     * );
     * ```
     */
    registerMessageRenderer(
        eventTypeOrFilter: string | ((mxEvent: MatrixEvent) => boolean),
        renderer: CustomMessageRenderFunction,
        hints?: CustomMessageRenderHints,
    ): void;

    /**
     * Register a renderer for the room preview bar.
     *
     * The render function should return a rendered component.
     *
     * @param renderer - The render function for the room preview bar.
     * @example
     * ```
     *  customComponents.registerRoomPreviewBar((props, OriginalComponent) => {
     *      if (props.roomId === "!some_special_room_id:server") {
     *          return <YourCustomRoomPreviewBarComponent {...props} />;
     *      }
     *      return <YourCustomComponent mxEvent={props.mxEvent} />;
     *  });
     * ```
     */
    registerRoomPreviewBar(renderer: CustomRoomPreviewBarRenderFunction): void;
}
