import type { JSX } from "react";
import type { RoomEvent } from "matrix-js-sdk";

/**
 * Targets in Element for custom components.
 * @public
 */
export enum CustomComponentTarget {
    /**
     * Component that renders "m.room.message" events in the room timeline.
     */
    TextualBody = "TextualBody",
    /**
     * "Options" Context menu for a timeline event.
     * Use `buildContextMenuBlock` to build a section to be used by this component.
     * @see buildContextMenuBlock
     */
    MessageContextMenu = "MessageContextMenu",
}

export interface ContextMenuItem {
    /**
     * The human readable label for an event.
     * TODO: Should this be i18n-d
     */
    label: string;
    /**
     * The icon to use for this item.
     * https://github.com/vector-im/riot-web/blob/efc6149a8b3362c01b93f52e76e5c4ae8cbcb65c/res/css/views/context_menus/_MessageContextMenu.pcss#L10
     */
    iconClassName: string;
    /**
     * Handler for click events on the context menu item.
     * Does NOT close the menu after execution.
     */
    onClick: (
        e: React.MouseEvent<Element> | React.KeyboardEvent<Element> | React.FormEvent<Element>,
    ) => void | Promise<void>;
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
        mxEvent: RoomEvent;
        /**
         * Words to highlight on (e.g. from search results).\
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
    [CustomComponentTarget.MessageContextMenu]: {
        /**
         * The Matrix event which this context menu targets.
         */
        mxEvent: RoomEvent;
        /**
         * Function that will close the menu.
         */
        closeMenu: () => void;
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
     * The original component.
     */
    originalComponent: JSX.Element,
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

    /**
     * Generate a context menu section for a given set of items.
     * @param items - A set of items to render.
     */
    buildContextMenuBlock(items: ContextMenuItem[]): JSX.Element;
}
