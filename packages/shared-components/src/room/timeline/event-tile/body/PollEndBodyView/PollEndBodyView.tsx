/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX, type Ref } from "react";
import { PollsEndIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import styles from "./PollEndBodyView.module.css";

export interface PollEndBodyViewProps {
    /**
     * Summary of the ended poll, e.g. "The poll has ended. Top answer: yes".
     */
    text: string;
    /**
     * Optional CSS class names applied to the root element.
     */
    className?: string;
    /**
     * Optional ref forwarded to the root element.
     */
    ref?: Ref<HTMLSpanElement>;
}

/**
 * Renders the body for a poll end event: the ended poll icon followed by a summary of the result.
 */
export function PollEndBodyView({ text, className, ref }: Readonly<PollEndBodyViewProps>): JSX.Element {
    return (
        <span className={classNames(styles.content, className)} ref={ref}>
            <PollsEndIcon className={styles.icon} aria-hidden="true" />
            <span>{text}</span>
        </span>
    );
}
