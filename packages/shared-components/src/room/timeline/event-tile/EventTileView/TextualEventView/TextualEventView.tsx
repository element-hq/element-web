/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, type JSX } from "react";
import classNames from "classnames";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import styles from "./TextualEventView.module.css";
import { useEventPresentationAttributes } from "../../../EventPresentation/EventPresentationContext";

export type TextualEventViewSnapshot = {
    content: string | ReactNode;
};

export interface Props {
    /** The view model for the tile error fallback. */
    vm: ViewModel<TextualEventViewSnapshot>;

    /** Optional host-level class names. */
    className?: string;
}

/**
 * Renders a plain textual timeline event without message-body decorations.
 *
 * This view is used for simple informational timeline entries where the
 * content is already prepared by the view model.
 */
export function TextualEventView({ vm, className }: Readonly<Props>): JSX.Element {
    const eventPresentationAttributes = useEventPresentationAttributes();
    const snapshot = useViewModel(vm);
    return (
        <div className={classNames(styles.textualEvent, className)} {...eventPresentationAttributes}>
            {snapshot.content}
        </div>
    );
}
