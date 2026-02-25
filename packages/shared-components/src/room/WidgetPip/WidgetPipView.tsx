/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type RefObject, type FC } from "react";
import { ChevronLeftIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { IconButton } from "@vector-im/compound-web";

import styles from "./WidgetPipView.module.css";
import { useViewModel, type ViewModel } from "../../viewmodel";
import { useI18n } from "../..";

export interface WidgetPipViewActions {
    onBackClick: (ev: React.MouseEvent<Element, MouseEvent>) => void;
    onViewedRoomChanged: (viewed: boolean) => void;
    persistentAppComponent: React.FC<{
        persistentWidgetId: any;
        persistentRoomId: any;
        pointerEvents: any;
        movePersistedElement: RefObject<(() => void) | null>;
    }>;
}

export interface WidgetPipViewSnapshot {
    widgetId: string;
    roomName: string;
    roomId: string;
}

/**
 * The view model for RoomStatusBarView.
 */
export type WidgetPipViewModel = ViewModel<WidgetPipViewSnapshot> & WidgetPipViewActions;

export interface WidgetPipViewProps {
    vm: WidgetPipViewModel;
    RoomAvatar: React.FC<{ size: string }>;
    onStartMoving: (ev: React.MouseEvent<Element, MouseEvent>) => void;
    movePersistedElement: RefObject<(() => void) | null>;
}

/**
 * A picture-in-picture view for a widget. Additional controls are shown if the
 * widget is a call of some sort.
 */
export const WidgetPipView: FC<WidgetPipViewProps> = ({ vm, RoomAvatar, onStartMoving, movePersistedElement }) => {
    const snapshot = useViewModel(vm);
    const { translate: _t } = useI18n();
    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div className={styles.container} onMouseDown={onStartMoving}>
            <div className={styles.header}>
                <IconButton
                    size="28px"
                    data-testid="base-card-back-button"
                    onClick={vm.onBackClick}
                    tooltip={_t("action|back")}
                    kind="secondary"
                >
                    <ChevronLeftIcon />
                </IconButton>
                <RoomAvatar size="20px" />
                {snapshot.roomName}
            </div>
            <div className={styles.roundedCornerContainer}>
                <vm.persistentAppComponent
                    persistentWidgetId={snapshot.widgetId}
                    persistentRoomId={snapshot.roomId}
                    pointerEvents="none"
                    movePersistedElement={movePersistedElement}
                >
                    {}
                </vm.persistentAppComponent>
            </div>
        </div>
    );
};
