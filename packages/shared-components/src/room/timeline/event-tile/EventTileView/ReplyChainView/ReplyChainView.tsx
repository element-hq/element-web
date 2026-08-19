/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useEffect, useRef, type JSX, type ReactNode } from "react";
import classNames from "classnames";
import { InlineSpinner } from "@vector-im/compound-web";

import { useI18n } from "../../../../../core/i18n/i18nContext";
import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import styles from "./ReplyChainView.module.css";

export type ReplyChainColor = 1 | 2 | 3 | 4 | 5 | 6;

/** Event metadata required by the shared ReplyChain presentation. */
export interface ReplyChainViewEvent {
    /** Stable Matrix event identifier used as the React key. */
    id: string;
    /** Decorative border colour selected for the event sender. */
    color: ReplyChainColor;
}

/** Snapshot consumed by ReplyChainView. */
export interface ReplyChainViewSnapshot {
    /** Current loading/rendering state of the reply chain. */
    status: "loading" | "error" | "ready" | "export";
    /** Events rendered as reply tiles, in oldest-to-newest order. */
    events: readonly ReplyChainViewEvent[];
    /** Event ID used to render the "in reply to" sender pill. */
    headerEventId?: string;
    /** Event ID targeted by the export-mode anchor. */
    parentEventId?: string;
    /** Explicit quote expansion state, when controlled by the host. */
    isQuoteExpanded?: boolean;
}

/** Actions exposed by the ReplyChain view model. */
export interface ReplyChainViewActions {
    /** Loads the next event in the reply chain and focuses the composer. */
    onQuoteClick: () => void;
    /** Requests the host to update the quote expansion state. */
    setQuoteExpanded: (isExpanded: boolean) => void;
}

/** View-model contract implemented by the application-side ReplyChainViewModel. */
export type ReplyChainViewModel = ViewModel<ReplyChainViewSnapshot> & ReplyChainViewActions;

export interface ReplyChainViewProps {
    /** View model supplying the snapshot and actions. */
    vm: ReplyChainViewModel;
    /** Renders the application-owned ReplyTile for one event. */
    renderReplyTile: (event: ReplyChainViewEvent) => ReactNode;
    /** Renders the application-owned sender pill in the reply header. */
    renderHeaderPill?: (eventId: string) => ReactNode;
}

const colorClassNames: Record<ReplyChainColor, string> = {
    1: styles.color1,
    2: styles.color2,
    3: styles.color3,
    4: styles.color4,
    5: styles.color5,
    6: styles.color6,
};

/**
 * Shared presentation for the reply-chain shell.
 *
 * Matrix events, pills, and reply tiles remain application-owned render slots;
 * this view owns the semantic shell, translation, loading/error states, and
 * reply-chain styling.
 */
export function ReplyChainView({ vm, renderReplyTile, renderHeaderPill }: Readonly<ReplyChainViewProps>): JSX.Element {
    const snapshot = useViewModel(vm);
    const { translate: _t } = useI18n();
    const blockquoteRef = useRef<HTMLQuoteElement>(null);

    useEffect(() => {
        if (snapshot.status !== "ready" || snapshot.isQuoteExpanded !== undefined || !blockquoteRef.current) {
            return;
        }

        const eventBody = blockquoteRef.current.querySelector<HTMLElement>(".mx_EventTile_body");
        if (!eventBody) return;

        const code = eventBody.querySelector<HTMLElement>("code");
        const isCodeEllipsisShown = code ? code.offsetHeight >= 60 : false;
        const isEllipsisShown =
            isCodeEllipsisShown ||
            eventBody.offsetHeight >= 60 ||
            eventBody.clientHeight !== eventBody.scrollHeight ||
            [...eventBody.children].some((child) => child.clientHeight !== child.scrollHeight);

        if (isEllipsisShown) {
            vm.setQuoteExpanded(false);
        }
    }, [snapshot, vm]);

    let header: ReactNode;
    if (snapshot.status === "error") {
        header = (
            <blockquote className={classNames(styles.header, styles.error)} data-reply-chain data-reply-chain-error>
                {_t("timeline|reply|error_loading")}
            </blockquote>
        );
    } else if (snapshot.status === "ready" && snapshot.headerEventId) {
        const headerEventId = snapshot.headerEventId;
        header = (
            <blockquote
                className={classNames(styles.header, colorClassNames[snapshot.events[0]?.color ?? 1])}
                data-reply-chain
            >
                {_t(
                    "timeline|reply|in_reply_to",
                    {},
                    {
                        a: (sub) => (
                            <button
                                type="button"
                                className={styles.show}
                                data-reply-chain-show
                                onClick={vm.onQuoteClick}
                            >
                                {sub}
                            </button>
                        ),
                        pill: () => renderHeaderPill?.(headerEventId) ?? "",
                    },
                )}
            </blockquote>
        );
    } else if (snapshot.status === "export" && snapshot.parentEventId) {
        header = (
            <p className={styles.export} data-reply-chain-export>
                {_t(
                    "timeline|reply|in_reply_to_for_export",
                    {},
                    {
                        a: (sub) => (
                            <a
                                className={styles.exportAnchor}
                                href={`#${snapshot.parentEventId}`}
                                data-scroll-to={snapshot.parentEventId}
                            >
                                {" "}
                                {sub}{" "}
                            </a>
                        ),
                    },
                )}
            </p>
        );
    } else if (snapshot.status === "loading") {
        header = <InlineSpinner size={16} aria-label={_t("common|loading")} role="progressbar" />;
    }

    const events = snapshot.events.map((event, index) => (
        <blockquote
            ref={index === snapshot.events.length - 1 ? blockquoteRef : undefined}
            className={classNames(styles.quote, colorClassNames[event.color], {
                [styles.expanded]: snapshot.isQuoteExpanded === true,
                [styles.collapsed]: snapshot.isQuoteExpanded === false,
            })}
            data-reply-chain
            data-reply-chain-quote
            data-reply-chain-expanded={snapshot.isQuoteExpanded}
            key={event.id}
        >
            {renderReplyTile(event)}
        </blockquote>
    ));

    return (
        <div className={styles.root} data-reply-chain-wrapper>
            <div className={styles.headerContainer}>{header}</div>
            <div className={styles.events}>{events}</div>
        </div>
    );
}
