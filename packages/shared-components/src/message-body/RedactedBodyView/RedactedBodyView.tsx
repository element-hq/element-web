/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type Ref } from "react";
import classNames from "classnames";
import { DeleteIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Tooltip } from "@vector-im/compound-web";

import { type ViewModel } from "../../viewmodel";
import { useViewModel } from "../../viewmodel/useViewModel";
import styles from "./RedactedBodyView.module.css";

export interface RedactedBodyViewSnapshot {
    /**
     * Localized redaction message content.
     */
    text: string;
    /**
     * Optional localized tooltip shown with the redaction timestamp.
     */
    tooltip?: string;
}

export type RedactedBodyViewModel = ViewModel<RedactedBodyViewSnapshot>;

interface RedactedBodyViewProps {
    /**
     * ViewModel providing the rendered text and tooltip.
     */
    vm: RedactedBodyViewModel;
    /**
     * Optional CSS class name applied to the root span.
     */
    className?: string;
    /**
     * Optional ref forwarded to the root span.
     */
    ref?: Ref<HTMLSpanElement>;
}

export function RedactedBodyView({ vm, className, ref }: Readonly<RedactedBodyViewProps>): JSX.Element {
    const { text, tooltip } = useViewModel(vm);

    const content = (
        <span className={classNames(styles.content, className)} ref={ref}>
            <DeleteIcon className={styles.icon} aria-hidden="true" />
            <span>{text}</span>
        </span>
    );

    if (!tooltip) {
        return content;
    }

    return <Tooltip description={tooltip}>{content}</Tooltip>;
}
