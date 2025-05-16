import { ComponentType, JSX, MouseEventHandler, PropsWithChildren } from "react";

/**
 * Target of the renderer function.
 * @public
 */
export enum CustomComponentTarget {
    /**
     * TODO: We should make this more descriptive.
     * The renderer for text events in the timeline, such as "m.room.message"
     */
    TextualBody = "TextualBody",
    MessageContextMenu = "MessageContextMenu",
}

export interface ContextMenuItem {
    label: string;
    iconClassName: string;
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
         * The Matrix event information.
         * TODO: Should this just use the types from matrix-js-sdk?
         */
        mxEvent: any;
        /**
         * Words to highlight on
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
         * The Matrix event information.
         * TODO: Should this just use the types from matrix-js-sdk?
         */
        mxEvent: any;
        /**
         * Close the menu
         */
        closeMenu: () => void;
    };
};
/**
 * Render function. Returning null skips this function and passes it onto the next registered renderer.
 * @public
 */
export type CustomComponentRenderFunction<T extends CustomComponentTarget> = (
    props: CustomComponentProps[T],
    originalComponent: JSX.Element,
) => JSX.Element | null;

/**
 * The API for creating custom components.
 * @public
 */
export interface CustomComponentsApi {
    /**
     * Register a renderer for a component type.
     * @param target - The target type of component
     * @param renderer - The render method.
     */
    register<T extends CustomComponentTarget>(target: T, renderer: CustomComponentRenderFunction<T>): void;

    /**
     * Register a context menu section with a given set of items.
     * @param items - A set of items to render.
     */
    buildContextMenuBlock(items: ContextMenuItem[]): JSX.Element;
}
