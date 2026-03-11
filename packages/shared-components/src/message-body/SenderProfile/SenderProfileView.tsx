/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEventHandler, type JSX } from "react";
import classNames from "classnames";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./SenderProfileView.module.css";

export interface SenderProfileViewSnapshot {
    /**
     * Whether sender profile should be rendered.
     */
    isVisible: boolean;
    /**
     * Sender display name.
     */
    displayName: string;
    /**
     * Sender identifier rendered when disambiguation is needed.
     */
    displayIdentifier?: string;
    /**
     * Optional title used as tooltip.
     */
    title?: string;
    /**
     * Optional dynamic display-name color class.
     */
    colorClass?: string;
    /**
     * Additional classes applied to the root element.
     */
    className?: string;
    /**
     * Whether to emphasize the display name.
     */
    emphasizeDisplayName?: boolean;
}

export interface SenderProfileViewActions {
    /**
     * Optional click action for sender profile.
     */
    onClick?: MouseEventHandler<HTMLButtonElement | HTMLDivElement>;
}

export type SenderProfileViewModel = ViewModel<SenderProfileViewSnapshot> & SenderProfileViewActions;

interface SenderProfileViewProps {
    vm: SenderProfileViewModel;
}

export function SenderProfileView({ vm }: Readonly<SenderProfileViewProps>): JSX.Element {
    const { isVisible, displayName, displayIdentifier, title, colorClass, className, emphasizeDisplayName } =
        useViewModel(vm);

    if (!isVisible) {
        return <></>;
    }

    return (
        <button
            className={classNames(className, styles.senderProfile)}
            type={vm.onClick ? "button" : undefined}
            title={title}
            onClick={vm.onClick}
        >
            <span
                className={colorClass}
                data-part="display-name"
                data-emphasized={emphasizeDisplayName ? "true" : undefined}
                dir="auto"
            >
                {displayName}
            </span>
            {displayIdentifier && (
                <span data-part="mxid">{displayIdentifier}</span>
            )}
        </button>
    );
}
