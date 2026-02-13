/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";
import classNames from "classnames";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./ReactionRow.module.css";

export interface ReactionRowViewSnapshot {
    /**
     * Whether the row should be shown.
     */
    isVisible: boolean;
    /**
     * Rendered reaction items.
     */
    items: ReactNode[];
    /**
     * Whether to display the show-all button.
     */
    showAllVisible: boolean;
    /**
     * Show-all button label, pre-translated.
     */
    showAllLabel: string;
    /**
     * Toolbar aria-label, pre-translated.
     */
    toolbarAriaLabel: string;
    /**
     * Optional add-reaction button element.
     */
    addReactionButton?: ReactNode;
}

export interface ReactionRowViewActions {
    /**
     * Triggered when the show-all button is clicked.
     */
    onShowAllClick: () => void;
}

export type ReactionRowViewModel = ViewModel<ReactionRowViewSnapshot> & ReactionRowViewActions;

interface ReactionRowViewProps {
    vm: ReactionRowViewModel;
}

export function ReactionRowView({ vm }: Readonly<ReactionRowViewProps>): JSX.Element {
    const { isVisible, items, showAllVisible, showAllLabel, toolbarAriaLabel, addReactionButton } = useViewModel(vm);

    if (!isVisible) {
        return <></>;
    }

    return (
        <div className={classNames("mx_ReactionsRow", styles.reactionRow)} role="toolbar" aria-label={toolbarAriaLabel}>
            {items}
            {showAllVisible && (
                <button
                    type="button"
                    className={classNames(
                        "mx_ReactionsRow_showAll",
                        "mx_AccessibleButton",
                        "mx_AccessibleButton_hasKind",
                        "mx_AccessibleButton_kind_link_inline",
                        styles.showAllButton,
                    )}
                    onClick={vm.onShowAllClick}
                >
                    {showAllLabel}
                </button>
            )}
            {addReactionButton}
        </div>
    );
}
