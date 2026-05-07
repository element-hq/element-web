/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX, type Ref } from "react";
import { VisibilityOffIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Text } from "@vector-im/compound-web";

import { type ViewModel } from "../../../../../core/viewmodel";
import { useViewModel } from "../../../../../core/viewmodel/useViewModel";
import { useI18n } from "../../../../../core/i18n/i18nContext";
import styles from "./HiddenBodyView.module.css";

export interface HiddenBodyViewSnapshot {
    /**
     * Optional moderation reason supplied by the homeserver.
     */
    reason?: string;
}

export type HiddenBodyViewModel = ViewModel<HiddenBodyViewSnapshot>;

interface HiddenBodyViewProps {
    /**
     * ViewModel providing the hidden message details.
     */
    vm: HiddenBodyViewModel;
    /**
     * Optional CSS class name applied to the root span.
     */
    className?: string;
    /**
     * Optional ref forwarded to the root span.
     */
    ref?: Ref<HTMLSpanElement>;
}

/**
 * Renders a message-body placeholder for messages hidden pending moderation.
 */
export function HiddenBodyView({ vm, className, ref }: Readonly<HiddenBodyViewProps>): JSX.Element {
    const { reason } = useViewModel(vm);
    const _t = useI18n().translate;
    const text = reason ? _t("timeline|pending_moderation_reason", { reason }) : _t("timeline|pending_moderation");

    return (
        <span className={classNames(styles.content, className)} ref={ref}>
            <VisibilityOffIcon className={styles.icon} aria-hidden="true" />
            <Text as="span">{text}</Text>
        </span>
    );
}
