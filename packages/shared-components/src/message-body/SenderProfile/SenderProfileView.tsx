/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type KeyboardEventHandler, type MouseEventHandler } from "react";
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
    onClick?: MouseEventHandler<HTMLDivElement>;
}

export type SenderProfileViewModel = ViewModel<SenderProfileViewSnapshot> & SenderProfileViewActions;

interface SenderProfileViewProps {
    vm: SenderProfileViewModel;
}

export function SenderProfileView({ vm }: Readonly<SenderProfileViewProps>): JSX.Element {
    const { isVisible, displayName, displayIdentifier, title, colorClass, className, emphasizeDisplayName } =
        useViewModel(vm);

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> | undefined = vm.onClick
        ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  vm.onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
              }
          }
        : undefined;

    if (!isVisible) {
        return <></>;
    }

    return (
        <div
            className={classNames(styles.senderProfile, className)}
            title={title}
            onClick={vm.onClick}
            onKeyDown={handleKeyDown}
            role={vm.onClick ? "button" : undefined}
            tabIndex={vm.onClick ? 0 : undefined}
        >
            <span
                className={classNames(colorClass, {
                    [styles.senderProfile_displayName]: emphasizeDisplayName,
                    mx_DisambiguatedProfile_displayName: emphasizeDisplayName,
                })}
                dir="auto"
            >
                {displayName}
            </span>
            {displayIdentifier && (
                <span className={classNames("mx_DisambiguatedProfile_mxid", styles.senderProfile_mxid)}>
                    {displayIdentifier}
                </span>
            )}
        </div>
    );
}
