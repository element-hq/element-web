/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {JSX, type MouseEventHandler } from "react";
import classNames from "classnames";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import styles from "./DisambiguatedProfile.module.css";

import { useI18n } from "../../utils/i18nContext";
import { getUserNameColorClass } from "../../utils/FormattingUtils";
import UserIdentifier from "../../utils/UserIdentifier";


/**
 * Information about a member for disambiguation purposes.
 */

interface MemberInfo {
    userId: string;
    roomId: string;
    rawDisplayName?: string;
    disambiguate: boolean;
}


/**
 * The snapshot representing the current state of the DisambiguatedProfile.
 */
export interface DisambiguatedProfileViewSnapshot {

    member?: MemberInfo | null;
    fallbackName: string;
    colored?: boolean;
    emphasizeDisplayName?: boolean;
    withTooltip?: boolean;
    
}

/**
 * Actions that can be performed on the DisambiguatedProfile.
 */
export interface DisambiguatedProfileViewActions {
    /**
     * Optional click handler for the profile.
     */
    onClick?: MouseEventHandler<HTMLDivElement>;
}

/**
 * The view model for DisambiguatedProfileView.
 */
export type DisambiguatedProfileViewModel = ViewModel<DisambiguatedProfileViewSnapshot> &
    DisambiguatedProfileViewActions;

interface DisambiguatedProfileViewProps {
    /**
     * The view model for the disambiguated profile.
     */
    vm: DisambiguatedProfileViewModel;
    
}

/**
 * A component to display a user's profile with optional disambiguation.
 * Shows the display name and optionally the MXID when disambiguation is needed
 * (e.g., when multiple users have the same display name).
 *
 * @example
 * ```tsx
 * <DisambiguatedProfileView vm={disambiguatedProfileViewModel} />
 * ```
 */
export function DisambiguatedProfileView({ vm }: Readonly<DisambiguatedProfileViewProps>)  :JSX.Element {
    const { fallbackName, member, colored, emphasizeDisplayName, withTooltip } = useViewModel(vm);

        const rawDisplayName = member?.rawDisplayName || fallbackName;
        const mxid = member?.userId;

        let colorClass: string | undefined;
        if (colored) {
            colorClass = getUserNameColorClass(mxid ?? "");
        }

        let mxidElement;
        let title: string | undefined;
        const { translate: _t } = useI18n();

        if (mxid) {
            const identifier =
                UserIdentifier.getDisplayUserIdentifier?.(mxid, {
                    withDisplayName: true,
                    roomId: member.roomId,
                }) ?? mxid;
            if (member?.disambiguate) {
                mxidElement = <span className="mx_DisambiguatedProfile_mxid">{identifier}</span>;
            }
            title = _t("timeline|disambiguated_profile", {
                displayName: rawDisplayName,
                matrixId: identifier,
            });
        }

        const displayNameClasses = classNames(colorClass, {
            mx_DisambiguatedProfile_displayName: emphasizeDisplayName,
        });

    return (
        <div
            className={classNames(styles.mx_DisambiguatedProfile, "mx_DisambiguatedProfile")}
            title={withTooltip ? title : undefined}
            onClick={vm.onClick}
        >
            <span className={displayNameClasses} dir="auto">
                {rawDisplayName}
            </span>
            {mxidElement}
        </div>
    );
}
