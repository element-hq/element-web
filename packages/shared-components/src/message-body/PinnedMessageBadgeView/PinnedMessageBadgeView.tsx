/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type HTMLAttributes, type JSX } from "react";
import classNames from "classnames";
import PinIcon from "@vector-im/compound-design-tokens/assets/web/icons/pin-solid";

import styles from "./PinnedMessageBadgeView.module.css";
import { _t } from "../../utils/i18n";

export type PinnedMessageBadgeProps = HTMLAttributes<HTMLDivElement>;

/**
 * A badge indicating that a message is pinned.
 */
export function PinnedMessageBadge({
    className,
    children,
    ...props
}: Readonly<PinnedMessageBadgeProps>): JSX.Element {
    return (
        <div {...props} className={classNames("mx_PinnedMessageBadge", styles.pinnedMessageBadge, className)}>
            <PinIcon width="16px" height="16px" />
            {children ?? _t("room|pinned_message_badge")}
        </div>
    );
}
