/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX, type MouseEventHandler, type Ref } from "react";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { useI18n } from "../../../../../core/i18n/i18nContext";
import styles from "./MjolnirBodyView.module.css";

export type MjolnirBodyViewSnapshot = Record<never, never>;

export interface MjolnirBodyViewActions {
    /**
     * Invoked when the user chooses to show the hidden message.
     */
    onAllowClick: MouseEventHandler<HTMLButtonElement>;
}

export type MjolnirBodyViewModel = ViewModel<MjolnirBodyViewSnapshot, MjolnirBodyViewActions>;

interface MjolnirBodyViewProps {
    /**
     * ViewModel providing the action handler.
     */
    vm: MjolnirBodyViewModel;
    /**
     * Optional CSS class names applied to the root element.
     */
    className?: string;
    /**
     * Optional ref forwarded to the root element.
     */
    ref?: Ref<HTMLDivElement>;
}

/**
 * Renders the placeholder shown when a message is hidden because its sender is ignored.
 */
export function MjolnirBodyView({ vm, className, ref }: Readonly<MjolnirBodyViewProps>): JSX.Element {
    useViewModel(vm);
    const _t = useI18n().translate;

    return (
        <div className={classNames(styles.content, className)} ref={ref}>
            <i>
                {_t(
                    "timeline|mjolnir|message_hidden",
                    {},
                    {
                        a: (sub) => (
                            <button type="button" className={styles.allowButton} onClick={vm.onAllowClick}>
                                {sub}
                            </button>
                        ),
                    },
                )}
            </i>
        </div>
    );
}
