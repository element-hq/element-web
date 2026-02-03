/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";
//TODO: import { Icon as LateIcon } from "../../../res/img/sensor.svg";
import { ImageErrorIcon as LateIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

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
     * * The localized received timestamp formatted as full date
     * If specified will render both the sent-at and received-at timestamps in the tooltip
     */
    tsReceivedAt?: string;
    /**
     * If set to true then no tooltip will be shown
     */
    inhibitTooltip?: boolean;
    /**
     * Extra CSS classes to apply to the component
     */
    extraClassNames?: string[];
    /**
     * If specified, will be rendered as an anchor bearing the href, a `span` element will be used otherwise
     */
    href?: string;
}

export interface MessageTimestampViewActions {
    /**
     * Optional onClick handler to attach to the DOM element
     */
    onClick?: React.MouseEventHandler<HTMLElement>;
    /**
     * Optional onContextMenu handler to attach to the DOM element
     */
    onContextMenu?: React.MouseEventHandler<HTMLElement>;
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
 * times in the tooltip when `receivedTs` is provided.
 *
 * @example
 * ```tsx
 * <MessageTimestampView vm={messageTimestampViewModel} />
 * ```
 */
export function MessageTimestampView({ vm }: Readonly<MessageTimestampViewProps>): JSX.Element {
    const { translate: _t } = useI18n();

    const { ts, tsSentAt, tsReceivedAt, inhibitTooltip, extraClassNames, href } = useViewModel(vm);

    const handleKeyDown: React.KeyboardEventHandler<HTMLElement> | undefined = vm.onClick
        ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  vm.onClick?.(event as unknown as React.MouseEvent<HTMLElement>);
              }
          }
        : undefined;

    let label = tsSentAt;
    let caption: string | undefined;
    let icon: ReactNode | undefined;
    if (tsReceivedAt && tsReceivedAt?.length > 0) {
        label = _t("timeline|message_timestamp_sent_at", { dateTime: label });
        caption = _t("timeline|message_timestamp_received_at", {
            dateTime: tsReceivedAt,
        });
        icon = <LateIcon className={styles.icon} width="16" height="16" />;
    }

    let content;
    if (href) {
        content = (
            <a
                href={href}
                onClick={vm.onClick}
                onContextMenu={vm.onContextMenu}
                className={classNames(extraClassNames, styles.content)}
                role="button"
                aria-live="off"
            >
                {icon}
                {ts}
            </a>
        );
    } else {
        content = (
            <span
                onClick={vm.onClick}
                onKeyDown={handleKeyDown}
                onContextMenu={vm.onContextMenu}
                className={classNames(extraClassNames, styles.content)}
                aria-hidden={vm.onClick || !inhibitTooltip ? false : true}
                role={vm.onClick ? "button" : undefined}
                aria-live="off"
                tabIndex={vm.onClick || !inhibitTooltip ? 0 : undefined}
            >
                {icon}
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
