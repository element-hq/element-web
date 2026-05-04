/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { ThreadsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

type ThreadInfoProps = Readonly<{
    summary?: ReactNode;
    href?: string;
    label?: string;
}>;

/** Renders either a full thread summary node or a compact icon-plus-label thread indicator. */
export function ThreadInfo({ summary, href, label }: ThreadInfoProps): JSX.Element | undefined {
    if (summary) return <>{summary}</>;
    if (!label) return undefined;

    const content = (
        <>
            <ThreadsIcon />
            {label}
        </>
    );

    return href ? (
        <a className="mx_ThreadSummary_icon" href={href}>
            {content}
        </a>
    ) : (
        <p className="mx_ThreadSummary_icon">{content}</p>
    );
}
