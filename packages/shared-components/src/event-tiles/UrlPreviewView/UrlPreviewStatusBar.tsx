/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
// import { Button, IconButton } from "@vector-im/compound-web";
import { IconButton } from "@vector-im/compound-web";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";

import { useViewModel, type ViewModel } from "../../viewmodel";
import {
    UrlPreviewGroupView,
    type UrlPreviewGroupViewActions,
    type UrlPreviewGroupViewSnapshot,
} from "./UrlPreviewGroupView";
import styles from "./UrlPreviewStatusBar.module.css";

export interface UrlPreviewStatusBarProps {
    vm: ViewModel<UrlPreviewGroupViewSnapshot> & UrlPreviewGroupViewActions;
    onHideClick: () => Promise<void>;
}

/**
 * UrlPreviewGroupView renders a list of URL previews for a single event.
 */
export function UrlPreviewStatusBar({ vm, onHideClick }: UrlPreviewStatusBarProps): JSX.Element | null {
    const { previews } = useViewModel(vm);
    if (!previews.length) {
        return null;
    }
    return (
        <div className={styles.banner}>
            <div className={styles.content}>
                <UrlPreviewGroupView vm={vm} />
            </div>
            <div className={styles.actions}>
                <IconButton onClick={onHideClick}>
                    <CloseIcon />
                </IconButton>
            </div>
        </div>
    );
}
