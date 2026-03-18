/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { ThreadsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

type ThreadInfoProps = {
    summary?: ReactNode;
    href?: string;
    label?: string;
};

export function ThreadInfo({
    summary,
    href,
    label,
}: ThreadInfoProps): JSX.Element | undefined {
    if (summary) {
        return <>{summary}</>;
    }

    if (href && label) {
        return (
            <a className="mx_ThreadSummary_icon" href={href}>
                <ThreadsIcon />
                {label}
            </a>
        );
    }

    if (label) {
        return (
            <p className="mx_ThreadSummary_icon">
                <ThreadsIcon />
                {label}
            </p>
        );
    }

    return undefined;
}
