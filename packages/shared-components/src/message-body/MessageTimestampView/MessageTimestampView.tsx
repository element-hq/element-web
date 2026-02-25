/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler, type KeyboardEvent, type MouseEvent } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import styles from "./MessageTimestampView.module.css";
import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../viewmodel/useViewModel";
import { useI18n } from "../../utils/i18nContext";

export interface MessageTimestampViewSnapshot {
    /**
     * The localized timestamp to render in the component
     */
    ts: string;
    /**
     * The localized sent timestamp formatted as full date
     */
    tsSentAt: string;
    /**
     * The localized received timestamp formatted as full date
     * If specified will render both the sent-at and received-at timestamps in the tooltip
     */
    tsReceivedAt?: string;
    /**
     * If set to true then no tooltip will be shown
     */
    inhibitTooltip?: boolean;
    /**
     * Extra class name to apply to the component
     */
    className?: string;
    /**
     * If specified, will be rendered as an anchor bearing the href, a `span` element will be used otherwise
     */
    href?: string;
}

export interface MessageTimestampViewActions {
    /**
     * Optional onClick handler to attach to the DOM element
     */
    onClick?: MouseEventHandler<HTMLElement>;
    /**
     * Optional onContextMenu handler to attach to the DOM element
     */
    onContextMenu?: MouseEventHandler<HTMLElement>;
}

/**
 * The view model for the message timestamp.
 */
export type MessageTimestampViewModel = ViewModel<MessageTimestampViewSnapshot> & MessageTimestampViewActions;

interface MessageTimestampViewProps {
    /**
     * The view model for the message timestamp.
     */
    vm: MessageTimestampViewModel;
}

/**
 * Displays a message timestamp with optional tooltip details.
 *
 * The view model provides the timestamp values and display options. The component
 * can render as a link when `href` is set, and can show both sent-at and received-at
 * times in the tooltip when `tsReceivedAt` is provided.
 *
 * @example
 * ```tsx
 * <MessageTimestampView vm={messageTimestampViewModel} />
 * ```
 */
export function MessageTimestampView({ vm }: Readonly<MessageTimestampViewProps>): JSX.Element {
    const { translate: _t } = useI18n();

    const { ts, tsSentAt, tsReceivedAt, inhibitTooltip, className, href } = useViewModel(vm);

    const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
        if (vm.onClick) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                vm.onClick?.(event as unknown as MouseEvent<HTMLElement>);
            }
        }
    };

    let label = tsSentAt;
    let caption: string | undefined;
    if (tsReceivedAt && tsReceivedAt?.length > 0) {
        label = _t("timeline|message_timestamp_sent_at", { dateTime: label });
        caption = _t("timeline|message_timestamp_received_at", {
            dateTime: tsReceivedAt,
        });
    }

    let content;
    if (href) {
        content = (
            <a
                href={href}
                onClick={vm.onClick}
                onKeyDown={onKeyDown}
                onContextMenu={vm.onContextMenu}
                className={classNames(className, styles.content)}
                aria-live="off"
            >
                {ts}
            </a>
        );
    } else {
        content = (
            <span
                onClick={vm.onClick}
                onKeyDown={onKeyDown}
                onContextMenu={vm.onContextMenu}
                className={classNames(className, styles.content)}
                role={vm.onClick ? "link" : undefined}
                aria-live="off"
                tabIndex={vm.onClick || !inhibitTooltip ? 0 : undefined}
            >
                {ts}
            </span>
        );
    }

    if (inhibitTooltip) return content;

    return (
        <Tooltip description={label} caption={caption}>
            {content}
        </Tooltip>
    );
}
