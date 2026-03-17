/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";
import classNames from "classnames";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./ImageReplyBodyView.module.css";

export interface ImageReplyBodyViewSnapshot {
    /**
     * Controls whether the reply image body should render at all.
     */
    isVisible?: boolean;
    /**
     * Thumbnail/content node to render inside the reply body container.
     */
    thumbnail?: ReactNode;
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
}

export function ImageReplyBodyView({ vm, className }: Readonly<ImageReplyBodyViewProps>): JSX.Element {
    const { isVisible = true, thumbnail } = useViewModel(vm);

    if (!isVisible) {
        return <></>;
    }

    return <div className={classNames("mx_MImageReplyBody", styles.root, className)}>{thumbnail}</div>;
}
