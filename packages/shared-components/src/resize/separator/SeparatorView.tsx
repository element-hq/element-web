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

import { type ViewModel, useViewModel } from "../../core/viewmodel";
import styles from "./SeparatorView.module.css";
import { type ResizerViewSnapshot } from "..";
import { useI18n } from "../../core/i18n/i18nContext";

export interface SeparatorViewActions {
    /**
     * onPointerUp handler for separator.
     */
    onPointerUp: () => void;

    /**
     * onPointerMove handler for separator.
     */
    onPointerMove: () => void;

    /**
     * onPointerDown handler for separator.
     */
    onPointerDown: () => void;
}

interface Props {
    vm: ViewModel<ResizerViewSnapshot, SeparatorViewActions>;
    className?: string;
}

/**
 * Custom separator for collapsible left-panel based on {@link Separator}.
 */
export function SeparatorView({ vm, className }: Props): React.ReactNode {
    const { translate: _t } = useI18n();
    const { isCollapsed, isFocusedViaKeyboard } = useViewModel(vm);

    /**
     * There are two types of separator:
     * - bar: This shows a thick bar separator with a resize icon in the middle; shown when the panel is collapsed.
     * - border: This is just a 1px wide separator; shown when the panel is expanded.
     */
    const type = isCollapsed || isFocusedViaKeyboard ? "bar" : "border";

    const barContent = (
        <Tooltip description={_t("left_panel|separator_label")} placement="right">
            <DragIcon
                width="20px"
                height="12px"
                // Without a custom view-box, this svg would scale incorrectly and would appear tiny within the separator.
                // See https://github.com/element-hq/compound/issues/242
                viewBox="3.999704360961914 8.999704360961914 16.000295639038086 6.000591278076172"
                transform="rotate(90)"
            />
        </Tooltip>
    );

    /**
     * When rendering the border separator, we replace the regular 1px separator with a thicker
     * green separator when:
     * - the user hovers over the hit region (i.e the area at the edge of the panel
     *  from where you can start resizing the panel).
     * - the user focuses the separator through keyboard navigation.
     */
    const focusedBorder = (
        <div className={styles.activeSeparatorContainer}>
            <div className={styles.activeSeparator} />
        </div>
    );

    return (
        <Separator
            className={classNames(styles.separator, className)}
            onPointerUp={vm.onPointerUp}
            onPointerMove={vm.onPointerMove}
            onPointerDown={vm.onPointerDown}
            aria-label={_t("left_panel|separator_label")}
            data-separator-type={type}
            disableDoubleClick
        >
            {type === "bar" ? barContent : null}
            {focusedBorder}
        </Separator>
    );
}
