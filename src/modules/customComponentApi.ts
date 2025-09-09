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
    OriginalMessageComponentProps,
    CustomMessageRenderHints as ModuleCustomCustomMessageRenderHints,
    MatrixEvent as ModuleMatrixEvent,
    CustomRoomPreviewBarRenderFunction,
} from "@element-hq/element-web-module-api";
import type React from "react";

type EventTypeOrFilter = Parameters<ICustomComponentsApi["registerMessageRenderer"]>[0];

type EventRenderer = {
    eventTypeOrFilter: EventTypeOrFilter;
    renderer: CustomMessageRenderFunction;
    hints: ModuleCustomCustomMessageRenderHints;
};

interface CustomMessageComponentProps extends Omit<ModuleCustomMessageComponentProps, "mxEvent"> {
    mxEvent: MatrixEvent;
}

interface CustomMessageRenderHints extends Omit<ModuleCustomCustomMessageRenderHints, "allowDownloadingMedia"> {
    // Note. This just makes it easier to use this API on Element Web as we already have the moduleized event stored.
    allowDownloadingMedia?: () => Promise<boolean>;
}

export class CustomComponentsApi implements ICustomComponentsApi {
    /**
     * Convert a matrix-js-sdk event into a ModuleMatrixEvent.
     * @param mxEvent
     * @returns An event object, or `null` if the event was not a message event.
     */
    private static getModuleMatrixEvent(mxEvent: MatrixEvent): ModuleMatrixEvent | null {
        const eventId = mxEvent.getId();
        const roomId = mxEvent.getRoomId();
        const sender = mxEvent.sender;
        // Typically we wouldn't expect messages without these keys to be rendered
        // by the timeline, but for the sake of type safety.
        if (!eventId || !roomId || !sender) {
            // Not a message event.
            return null;
        }
        return {
            content: mxEvent.getContent(),
            eventId,
            originServerTs: mxEvent.getTs(),
            roomId,
            sender: sender.userId,
            stateKey: mxEvent.getStateKey(),
            type: mxEvent.getType(),
            unsigned: mxEvent.getUnsigned(),
        };
    }

    private readonly registeredMessageRenderers: EventRenderer[] = [];

    public registerMessageRenderer(
        eventTypeOrFilter: EventTypeOrFilter,
        renderer: CustomMessageRenderFunction,
        hints: ModuleCustomCustomMessageRenderHints = {},
    ): void {
        this.registeredMessageRenderers.push({ eventTypeOrFilter: eventTypeOrFilter, renderer, hints });
    }

    /**
     * Select the correct renderer based on the event information.
     * @param mxEvent The message event being rendered.
     * @returns The registered renderer.
     */
    private selectRenderer(mxEvent: ModuleMatrixEvent): EventRenderer | undefined {
        return this.registeredMessageRenderers.find((renderer) => {
            if (typeof renderer.eventTypeOrFilter === "string") {
                return renderer.eventTypeOrFilter === mxEvent.type;
            } else {
                try {
                    return renderer.eventTypeOrFilter(mxEvent);
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
        originalComponent?: (props?: OriginalMessageComponentProps) => React.JSX.Element,
    ): React.JSX.Element | null {
        const moduleEv = CustomComponentsApi.getModuleMatrixEvent(props.mxEvent);
        const renderer = moduleEv && this.selectRenderer(moduleEv);
        if (renderer) {
            try {
                return renderer.renderer({ ...props, mxEvent: moduleEv }, originalComponent);
            } catch (ex) {
                logger.warn("Message renderer failed to render", ex);
                // Fall through to original component. If the module encounters an error we still want to display messages to the user!
            }
        }
        return originalComponent?.() ?? null;
    }

    /**
     * Get hints about an message before rendering it.
     * @param mxEvent The message event being rendered.
     * @returns A component if a custom renderer exists, or originalComponent returns a value. Otherwise null.
     */
    public getHintsForMessage(mxEvent: MatrixEvent): CustomMessageRenderHints | null {
        const moduleEv = CustomComponentsApi.getModuleMatrixEvent(mxEvent);
        const renderer = moduleEv && this.selectRenderer(moduleEv);
        if (renderer) {
            return {
                ...renderer.hints,
                // Convert from js-sdk style events to module events automatically.
                allowDownloadingMedia: renderer.hints.allowDownloadingMedia
                    ? () => renderer.hints.allowDownloadingMedia!(moduleEv)
                    : undefined,
            };
        }
        return null;
    }

    private _roomPreviewBarRenderer?: CustomRoomPreviewBarRenderFunction;

    /**
     * Get the custom room preview bar renderer, if any has been registered.
     */
    public get roomPreviewBarRenderer(): CustomRoomPreviewBarRenderFunction | undefined {
        return this._roomPreviewBarRenderer;
    }

    /**
     * Register a custom room preview bar renderer.
     * @param renderer - the function that will render the custom room preview bar.
     */
    public registerRoomPreviewBar(renderer: CustomRoomPreviewBarRenderFunction): void {
        this._roomPreviewBarRenderer = renderer;
    }
}
