/*
Copyright (c) 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC } from "react";
import { ChevronLeftIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { IconButton } from "@vector-im/compound-web";

import styles from "./WidgetPipView.module.css";
import { useViewModel, type ViewModel } from "../../viewmodel";
import { useI18n } from "../..";

export interface WidgetPipViewActions {
    /**
     * Call this once the back button is clicked in the pip view.
     * The view model will handle navigating back to the associated room.
     * @param ev The mouse event that triggered the back click.
     */
    onBackClick: (ev: React.MouseEvent<Element, MouseEvent>) => void;
    /**
     * The view model needs to know if the room is currently being viewed.
     * @param viewing Whether we are currently viewing the room.
     */
    setViewingRoom: (viewing: boolean) => void;
    /**
     * The view model exposes the `<PersistentApp />` component via this action.
     * `PersistentApp` is not available in shared components.
     * It can be any React component that renders a widget.
     * It will be mounted inside the PipView.
     */
    persistentAppComponent: React.FC<{
        persistentWidgetId: string;
        persistentRoomId: string;
    }>;
    /**
     * Action that needs to be called when the pip view starts to get dragged.
     * @param ev The mouse event that triggered the drag start.
     */
    onStartMoving: (ev: React.MouseEvent<Element, MouseEvent>) => void;
}

export interface WidgetPipViewSnapshot {
    /**
     * The widget ID this view is rendering.
     */
    widgetId: string;
    /**
     * The room name the Pip View should use in the header.
     */
    roomName: string;
    /**
     * The room ID this PiP view’s widget is associated with.
     */
    roomId: string;
}

/**
 * The view model for the widget PiP view.
 */
export type WidgetPipViewModel = ViewModel<WidgetPipViewSnapshot> & WidgetPipViewActions;

export interface WidgetPipViewProps {
    /**
     * The WidgetPipViewModel to expose the WidgetPipViewSnapshot and to:
     *  - handling the back button callback.
     *  - exposing the persistentApp react component to the view.
     */
    vm: WidgetPipViewModel;
    /**
     * The avatar is passed as a React component.
     * This allows any avatar implementation to be used in this view (like RoomAvatar).
     */
    // In the future the avatar component can also become a shared component. Then it would be accessible
    // in the shared component package and we could remove this prop.
    RoomAvatar: React.FC<{ size: string }>;
}

/**
 * A picture-in-picture view for a widget. Additional controls are shown if the
 * widget represents a call.
 */
export const WidgetPipView: FC<WidgetPipViewProps> = ({ vm, RoomAvatar }) => {
    const snapshot = useViewModel(vm);
    const { translate: _t } = useI18n();
    return (
        // The interaction where we use the onMouseDown handler is only useful for dragging the widget around,
        // which is not possible via the keyboard. The outcome of this interaction can only be changed
        // if the user interacts with a mouse. Hence there is no use in providing an alternative.
        // In the future we might consider introducing alternative shortcuts for moving the PiP around
        // with the keyboard.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
            role="complementary"
            data-testid="widget-pip-container"
            className={styles.container}
            onMouseDown={vm.onStartMoving}
        >
            <div className={styles.header}>
                <IconButton
                    size="28px"
                    data-testid="base-card-back-button"
                    onClick={(ev) => vm.onBackClick(ev)}
                    tooltip={_t("action|back")}
                    kind="secondary"
                >
                    <ChevronLeftIcon />
                </IconButton>
                <RoomAvatar size="20px" />
                {snapshot.roomName}
            </div>
            <div className={styles.roundedCornerContainer}>
                <vm.persistentAppComponent persistentWidgetId={snapshot.widgetId} persistentRoomId={snapshot.roomId} />
            </div>
        </div>
    );
};
