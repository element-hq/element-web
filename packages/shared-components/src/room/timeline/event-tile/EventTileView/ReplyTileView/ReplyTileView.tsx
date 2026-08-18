/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler, type ReactNode } from "react";
import classNames from "classnames";

import { MemberAvatarView, type MemberAvatarViewModel } from "../../../../../core/MemberAvatar/MemberAvatarView";
import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { useEventPresentationAttributes } from "../../../EventPresentation/EventPresentationContext";
import styles from "./ReplyTileView.module.css";

export interface ReplyTileSenderViewSnapshot {
    /** Display name shown for the quoted event sender. */
    displayName: string;
    /** Optional member avatar ViewModel for the quoted event sender. */
    avatarViewModel?: MemberAvatarViewModel;
}

export interface ReplyTileViewSnapshot {
    /** The permalink for the event being quoted. */
    href: string;
    /** Optional sender presentation. */
    sender?: ReplyTileSenderViewSnapshot;
    /** Whether the reply should use the compact inline layout. */
    inline?: boolean;
    /** Whether the reply is an informational event. */
    info?: boolean;
    /** The rendered reply body. */
    body: ReactNode;
}

export interface ReplyTileViewActions {
    /** Invoked when the reply link is activated. */
    onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export type ReplyTileViewModel = ViewModel<ReplyTileViewSnapshot, ReplyTileViewActions>;

export interface ReplyTileViewProps {
    /** ViewModel providing reply presentation and activation behavior. */
    vm: ReplyTileViewModel;
}

/**
 * Renders the presentation shell for a compact event reply.
 *
 * Event-specific data and body rendering remain in the host application so
 * this component can be reused by different timeline implementations.
 */
export function ReplyTileView({ vm }: ReplyTileViewProps): JSX.Element {
    const { href, sender, inline, info, body } = useViewModel(vm);
    const eventPresentationAttributes = useEventPresentationAttributes();

    return (
        <div
            className={classNames(styles.root, {
                [styles.inline]: inline,
                [styles.info]: info,
            })}
            data-testid="reply-tile"
            {...eventPresentationAttributes}
        >
            <a className={styles.link} href={href} onClick={vm.onClick}>
                {sender ? (
                    <div className={styles.sender} data-testid="reply-tile-sender">
                        {sender.avatarViewModel ? (
                            <MemberAvatarView vm={sender.avatarViewModel} classNames={styles.avatar} />
                        ) : null}
                        <span className={styles.senderName} dir="auto">
                            {sender.displayName}
                        </span>
                    </div>
                ) : null}
                <div className={styles.body}>{body}</div>
            </a>
        </div>
    );
}
