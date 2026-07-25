/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentPropsWithoutRef, type JSX, type MouseEventHandler, type ReactNode } from "react";
import { Avatar, IndicatorIcon, Tooltip } from "@vector-im/compound-web";
import { ChevronRightIcon, ThreadsSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import styles from "./ThreadSummary.module.css";

export type ThreadSummaryNotificationIndicator = ComponentPropsWithoutRef<typeof IndicatorIcon>["indicator"];

export interface ThreadMessagePreviewAvatar {
    /**
     * Optional class name supplied by the app for integration styling.
     */
    className?: string;
    /**
     * Stable id used for avatar colour hashing.
     */
    id: string;
    /**
     * Name used by the avatar fallback.
     */
    name: string;
    /**
     * Optional avatar image URL.
     */
    src?: string;
    /**
     * Accessible label for the avatar.
     */
    label: string;
    /**
     * Optional tooltip/title text for the avatar image.
     */
    title?: string;
}

export interface ThreadMessagePreviewViewSnapshot {
    /**
     * Controls whether the preview should render.
     */
    isVisible: boolean;
    /**
     * Sender avatar data.
     */
    avatar?: ThreadMessagePreviewAvatar;
    /**
     * Whether to render the sender display name.
     */
    showDisplayName: boolean;
    /**
     * Sender display name.
     */
    senderName?: string;
    /**
     * Rendered preview content.
     */
    previewContent?: ReactNode;
    /**
     * Optional styled tooltip text for the preview content.
     */
    previewTooltip?: string;
}

export type ThreadMessagePreviewViewModel = ViewModel<ThreadMessagePreviewViewSnapshot>;

export interface ThreadSummaryViewSnapshot {
    /**
     * Controls whether the summary should render.
     */
    isVisible: boolean;
    /**
     * Text for the reply count section.
     */
    replyCountLabel: string;
    /**
     * Accessible label for opening the thread.
     */
    openThreadLabel: string;
    /**
     * Notification indicator shown on the thread icon.
     */
    notificationIndicator?: ThreadSummaryNotificationIndicator;
    /**
     * Whether the summary is being rendered in the narrow timeline layout.
     */
    narrow: boolean;
    /**
     * View model for the last-message preview.
     */
    previewVm: ThreadMessagePreviewViewModel;
}

export interface ThreadSummaryViewActions {
    /**
     * Invoked when the user opens the thread.
     */
    onClick?: MouseEventHandler<HTMLButtonElement>;
}

export type ThreadSummaryViewModel = ViewModel<ThreadSummaryViewSnapshot, ThreadSummaryViewActions>;

type ThreadSummaryViewProps = Omit<ComponentPropsWithoutRef<"button">, "aria-label" | "onClick"> & {
    /**
     * The view model for the thread summary.
     */
    vm: ThreadSummaryViewModel;
};

interface ThreadMessagePreviewViewProps {
    /**
     * The view model for the thread message preview.
     */
    vm: ThreadMessagePreviewViewModel;
}

export function ThreadMessagePreviewView({ vm }: Readonly<ThreadMessagePreviewViewProps>): JSX.Element {
    const { isVisible, avatar, showDisplayName, senderName, previewContent, previewTooltip } = useViewModel(vm);

    if (!isVisible || !previewContent) {
        return <></>;
    }

    const content = <span className={styles.content}>{previewContent}</span>;
    const avatarClassName = avatar?.className ? `${styles.avatar} ${avatar.className}` : styles.avatar;

    return (
        <>
            {avatar && (
                <Avatar
                    id={avatar.id}
                    name={avatar.name}
                    src={avatar.src}
                    title={avatar.title}
                    aria-label={avatar.label}
                    type="round"
                    size="24px"
                    className={avatarClassName}
                />
            )}
            {showDisplayName && senderName && <div className={styles.sender}>{senderName}</div>}
            {previewTooltip ? <Tooltip description={previewTooltip}>{content}</Tooltip> : content}
        </>
    );
}

export function ThreadSummaryView({
    vm,
    className,
    type = "button",
    ...props
}: Readonly<ThreadSummaryViewProps>): JSX.Element {
    const { isVisible, replyCountLabel, openThreadLabel, notificationIndicator, narrow, previewVm } = useViewModel(vm);

    if (!isVisible) {
        return <></>;
    }

    const buttonClassName = [styles.threadSummary, className, narrow ? styles.narrow : undefined]
        .filter(Boolean)
        .join(" ");

    return (
        <button {...props} type={type} className={buttonClassName} onClick={vm.onClick} aria-label={openThreadLabel}>
            <IndicatorIcon size="24px" indicator={notificationIndicator} className={styles.threadIcon}>
                <ThreadsSolidIcon />
            </IndicatorIcon>
            <span className={styles.repliesAmount}>{replyCountLabel}</span>
            <ThreadMessagePreviewView vm={previewVm} />
            <div className={styles.chevron}>
                <ChevronRightIcon />
            </div>
        </button>
    );
}
