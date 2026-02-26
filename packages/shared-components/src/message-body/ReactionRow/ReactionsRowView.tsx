/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler, type ReactNode } from "react";
import classNames from "classnames";
import { ReactionAddIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./ReactionsRow.module.css";

export interface ReactionsRowViewSnapshot {
    /**
     * Toolbar label announced by assistive technologies.
     */
    ariaLabel: string;
    /**
     * Controls whether the row should render at all.
     */
    isVisible: boolean;
    /**
     * Reaction button elements to render in the row.
     */
    children?: ReactNode;
    /**
     * Optional CSS className for the row container.
     */
    className?: string;
    /**
     * Whether to render the "show all" button.
     */
    showAllButtonVisible?: boolean;
    /**
     * Label shown for the "show all" button.
     */
    showAllButtonLabel?: string;
    /**
     * Whether to render the add-reaction button.
     */
    showAddReactionButton?: boolean;
    /**
     * Accessible label for the add-reaction button.
     */
    addReactionButtonLabel?: string;
    /**
     * Force the add-reaction button to be visible.
     */
    addReactionButtonVisible?: boolean;
    /**
     * Marks the add-reaction button as active.
     */
    addReactionButtonActive?: boolean;
    /**
     * Disables the add-reaction button.
     */
    addReactionButtonDisabled?: boolean;
}

export interface ReactionsRowViewActions {
    /**
     * Invoked when the user clicks the "show all" button.
     */
    onShowAllClick?: () => void;
    /**
     * Invoked when the user clicks the add-reaction button.
     */
    onAddReactionClick?: MouseEventHandler<HTMLButtonElement>;
    /**
     * Invoked on right-click/context-menu for the add-reaction button.
     */
    onAddReactionContextMenu?: MouseEventHandler<HTMLButtonElement>;
}

export type ReactionsRowViewModel = ViewModel<ReactionsRowViewSnapshot> & ReactionsRowViewActions;

interface ReactionsRowViewProps {
    vm: ReactionsRowViewModel;
}

export function ReactionsRowView({ vm }: Readonly<ReactionsRowViewProps>): JSX.Element {
    const {
        ariaLabel,
        isVisible,
        children,
        className,
        showAllButtonVisible,
        showAllButtonLabel,
        showAddReactionButton,
        addReactionButtonLabel,
        addReactionButtonVisible,
        addReactionButtonActive,
        addReactionButtonDisabled,
    } = useViewModel(vm);

    if (!isVisible) {
        return <></>;
    }

    const addReactionButtonClasses = classNames(styles.addReactionButton, {
        [styles.addReactionButtonVisible]: addReactionButtonVisible,
        [styles.addReactionButtonActive]: addReactionButtonActive,
        [styles.addReactionButtonDisabled]: addReactionButtonDisabled,
    });

    const onAddReactionContextMenu: MouseEventHandler<HTMLButtonElement> | undefined = vm.onAddReactionContextMenu
        ? (event): void => {
              event.preventDefault();
              vm.onAddReactionContextMenu?.(event);
          }
        : undefined;

    return (
        <div className={classNames(className, styles.reactionsRow)} role="toolbar" aria-label={ariaLabel}>
            {children}
            {showAllButtonVisible && (
                <button type="button" className={styles.showAllButton} onClick={vm.onShowAllClick}>
                    {showAllButtonLabel}
                </button>
            )}
            {showAddReactionButton && (
                <button
                    type="button"
                    className={addReactionButtonClasses}
                    aria-label={addReactionButtonLabel}
                    title={addReactionButtonLabel}
                    disabled={addReactionButtonDisabled}
                    onClick={vm.onAddReactionClick}
                    onContextMenu={onAddReactionContextMenu}
                >
                    <ReactionAddIcon />
                </button>
            )}
        </div>
    );
}
