/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { Separator } from "react-resizable-panels";
import DragIcon from "@vector-im/compound-design-tokens/assets/web/icons/drag-list";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./SeparatorView.module.css";
import { type ResizerSnapshot } from "..";

export interface SeparatorViewActions {
    /**
     * onClick handler for the separator.
     */
    onSeparatorClick: () => void;
}

interface Props {
    vm: ViewModel<ResizerSnapshot, SeparatorViewActions>;
}

export function SeparatorView({ vm }: Props): React.ReactNode {
    const { isCollapsed } = useViewModel(vm);

    const classes = classNames(styles.separator, {
        [styles.collapsed]: isCollapsed,
    });

    return (
        <Separator className={classes} onClick={vm.onSeparatorClick} aria-label="Click or drag to expand">
            <Tooltip description="Click or drag to expand" placement="right">
                <DragIcon
                    width="20px"
                    height="12px"
                    // Without a custom view-box, this svg would scale incorrectly and would appear tiny within the separator.
                    // See https://github.com/element-hq/compound/issues/242
                    viewBox="3.999704360961914 8.999704360961914 16.000295639038086 6.000591278076172"
                    transform="rotate(90)"
                />
            </Tooltip>
        </Separator>
    );
}
