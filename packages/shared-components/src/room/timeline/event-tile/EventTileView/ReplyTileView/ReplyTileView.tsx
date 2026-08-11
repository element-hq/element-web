/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler, type ReactNode, type Ref } from "react";
import classNames from "classnames";

import styles from "./ReplyTileView.module.css";

export interface ReplyTileViewProps {
    /** The permalink for the event being quoted. */
    href: string;
    /** Invoked when the reply link is activated. */
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    /** Optional sender presentation. */
    sender?: ReactNode;
    /** Whether the reply should use the compact inline layout. */
    inline?: boolean;
    /** Whether the reply is an informational event. */
    info?: boolean;
    /** The rendered reply body. */
    children: ReactNode;
    /** Ref attached to the permalink anchor. */
    ref?: Ref<HTMLAnchorElement>;
    /** Optional class name applied to the root element. */
    className?: string;
    /** Optional class name applied to the sender container. */
    senderClassName?: string;
}

/**
 * Renders the presentation shell for a compact event reply.
 *
 * Event-specific data and body rendering remain in the host application so
 * this component can be reused by different timeline implementations.
 */
export function ReplyTileView({
    href,
    onClick,
    sender,
    inline,
    info,
    children,
    ref,
    className,
    senderClassName,
}: ReplyTileViewProps): JSX.Element {
    return (
        <div
            className={classNames(
                styles.root,
                {
                    [styles.inline]: inline,
                    [styles.info]: info,
                },
                className,
            )}
        >
            <a href={href} onClick={onClick} ref={ref}>
                {sender ? <div className={classNames(styles.sender, senderClassName)}>{sender}</div> : null}
                {children}
            </a>
        </div>
    );
}
