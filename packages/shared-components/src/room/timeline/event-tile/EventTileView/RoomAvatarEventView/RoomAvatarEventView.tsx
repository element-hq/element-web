/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX, type ReactNode, type Ref } from "react";

import { useI18n } from "../../../../../core/i18n/i18nContext";
import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { useEventPresentationAttributes } from "../../../EventPresentation/EventPresentationContext";
import styles from "./RoomAvatarEventView.module.css";

export interface RoomAvatarEventViewSnapshot {
    /**
     * Display name for the event sender.
     */
    senderDisplayName: string;
    /**
     * Room name at the time the avatar event is rendered.
     */
    roomName: string;
    /**
     * MXC URL from the avatar event content.
     */
    avatarUrl?: string;
    /**
     * Accessible label for opening the avatar preview.
     */
    lightboxLabel: string;
    /**
     * Whether this event removed the room avatar.
     */
    isRemoved: boolean;
}

export interface RoomAvatarEventViewActions {
    /**
     * Invoked when the user opens the avatar image.
     */
    onAvatarClick(this: void): void;
}

export type RoomAvatarEventViewModel = ViewModel<RoomAvatarEventViewSnapshot, RoomAvatarEventViewActions>;

export interface RoomAvatarEventViewProps {
    /**
     * ViewModel providing room avatar event state and actions.
     */
    vm: RoomAvatarEventViewModel;
    /**
     * Renders the avatar thumbnail using the host application's avatar implementation.
     */
    renderAvatar(snapshot: RoomAvatarEventViewSnapshot): ReactNode;
    /**
     * Optional CSS class names applied to the root element.
     */
    className?: string;
    /**
     * Optional ref forwarded to the root element.
     */
    ref?: Ref<HTMLElement>;
}

/**
 * Renders a room avatar state event.
 */
export function RoomAvatarEventView({
    vm,
    renderAvatar,
    className,
    ref,
}: Readonly<RoomAvatarEventViewProps>): JSX.Element {
    const snapshot = useViewModel(vm);
    const _t = useI18n().translate;
    const eventPresentationAttributes = useEventPresentationAttributes();
    const classes = classNames(styles.textualEvent, className);

    if (snapshot.isRemoved) {
        return (
            <div className={classes} ref={ref as Ref<HTMLDivElement>} {...eventPresentationAttributes}>
                {_t("timeline|m.room.avatar|removed", { senderDisplayName: snapshot.senderDisplayName })}
            </div>
        );
    }

    return (
        <span className={classes} ref={ref as Ref<HTMLSpanElement>} {...eventPresentationAttributes}>
            {_t(
                "timeline|m.room.avatar|changed_img",
                { senderDisplayName: snapshot.senderDisplayName },
                {
                    img: () => (
                        <button
                            type="button"
                            className={styles.avatarButton}
                            onClick={vm.onAvatarClick}
                            aria-label={snapshot.lightboxLabel}
                        >
                            {renderAvatar(snapshot)}
                        </button>
                    ),
                },
            )}
        </span>
    );
}
