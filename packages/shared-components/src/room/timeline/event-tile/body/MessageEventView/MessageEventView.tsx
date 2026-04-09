/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren } from "react";
import classNames from "classnames";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import styles from "./MessageEventView.module.css";

export interface MessageEventViewSnapshot {
    /**
     * Whether the event should render inside the caption layout shell.
     */
    hasCaption: boolean;
}

export type MessageEventViewModel = ViewModel<MessageEventViewSnapshot>;

interface MessageEventViewProps {
    /**
     * View model providing the caption-layout state.
     */
    vm: MessageEventViewModel;
    /**
     * Optional class name applied to the caption wrapper.
     */
    className?: string;
    /**
     * Primary body content.
     */
    children?: PropsWithChildren["children"];
    /**
     * Optional caption body rendered after the primary body.
     */
    caption?: PropsWithChildren["children"];
}

export function MessageEventView({ vm, className, children, caption }: Readonly<MessageEventViewProps>): JSX.Element {
    const { hasCaption } = useViewModel(vm);
    const shouldRenderCaptionLayout = hasCaption && caption !== undefined && caption !== null;

    if (!shouldRenderCaptionLayout) {
        return <>{children}</>;
    }

    return <div className={classNames(styles.content, className)}>{children}{caption}</div>;
}
