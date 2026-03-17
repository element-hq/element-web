/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type PropsWithChildren } from "react";
import classNames from "classnames";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./ImageReplyBodyView.module.css";

export interface ImageReplyBodyViewSnapshot {
    /**
     * Controls whether the reply image body should render at all.
     */
    isVisible?: boolean;
}

export type ImageReplyBodyViewModel = ViewModel<ImageReplyBodyViewSnapshot>;

interface ImageReplyBodyViewProps {
    /**
     * The view model driving the reply image body.
     */
    vm: ImageReplyBodyViewModel;
    /**
     * Optional CSS class for host-level styling.
     */
    className?: string;
    /**
     * Reply image content to render inside the container.
     */
    children?: PropsWithChildren["children"];
}

export function ImageReplyBodyView({ vm, className, children }: Readonly<ImageReplyBodyViewProps>): JSX.Element {
    const { isVisible = true } = useViewModel(vm);

    if (!isVisible) {
        return <></>;
    }

    return <div className={classNames(styles.imageReplyBodyView, className)}>{children}</div>;
}
