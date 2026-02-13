/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type JSX } from "react";
import React from "react";
import classNames from "classnames";

import { type ViewModel, useViewModel } from "../../viewmodel";
import { ReactionsRowButtonTooltipView, type ReactionsRowButtonTooltipViewModel } from "../ReactionsRowButtonTooltip";

export interface ReactionsRowButtonViewSnapshot {
    /**
     * The reaction content to display when not using a custom image.
     */
    content?: string;
    /**
     * The total number of reactions for this content.
     */
    count: number;
    /**
     * The aria-label for the button.
     */
    ariaLabel?: string;
    /**
     * Whether the reaction button is selected by the current user.
     */
    isSelected: boolean;
    /**
     * Whether the reaction button is disabled.
     */
    isDisabled?: boolean;
    /**
     * The image URL to render when using a custom reaction image.
     */
    imageSrc?: string;
    /**
     * The alt text for the custom reaction image.
     */
    imageAlt?: string;
}

export interface ReactionsRowButtonViewActions {
    /**
     * Called when the user activates the reaction button.
     */
    onClick: () => void;
    /**
     * View model for the tooltip wrapper.
     */
    tooltipVm: ReactionsRowButtonTooltipViewModel;
}

export type ReactionsRowButtonViewModel = ViewModel<ReactionsRowButtonViewSnapshot> & ReactionsRowButtonViewActions;

interface ReactionsRowButtonViewProps {
    /**
     * The view model for the reactions row button.
     */
    vm: ReactionsRowButtonViewModel;
}

/**
 * Renders the reaction button in a reactions row.
 */
export function ReactionsRowButtonView({ vm }: Readonly<ReactionsRowButtonViewProps>): JSX.Element {
    const { content, count, ariaLabel, isSelected, isDisabled, imageSrc, imageAlt } = useViewModel(vm);
    const ariaDisabled = isDisabled ? true : undefined;
    const disabled = isDisabled ? true : undefined;

    const classes = classNames("mx_AccessibleButton", "mx_ReactionsRowButton", {
        mx_ReactionsRowButton_selected: isSelected,
        mx_AccessibleButton_disabled: isDisabled,
    });

    const reactionContent = imageSrc ? (
        <img className="mx_ReactionsRowButton_content" alt={imageAlt ?? ""} src={imageSrc} width="16" height="16" />
    ) : (
        <span className="mx_ReactionsRowButton_content" aria-hidden="true">
            {content ?? ""}
        </span>
    );

    return (
        <ReactionsRowButtonTooltipView vm={vm.tooltipVm}>
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <div
                className={classes}
                role="button"
                tabIndex={0}
                aria-label={ariaLabel}
                aria-disabled={ariaDisabled}
                disabled={disabled}
                onClick={isDisabled ? undefined : vm.onClick}
            >
                {reactionContent}
                <span className="mx_ReactionsRowButton_count" aria-hidden="true">
                    {count}
                </span>
            </div>
        </ReactionsRowButtonTooltipView>
    );
}
