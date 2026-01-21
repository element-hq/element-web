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
    /**
    * The user's Matrix ID.
    */
    userId: string;
    /** 
     * The room ID where the member is present. 
     */
    roomId: string;
    /** 
     * The raw display name of the user. 
     */
    rawDisplayName?: string;
    /** 
     * Whether to show disambiguation (i.e., the MXID) alongside the display name. 
     */
    disambiguate: boolean;
}


/**
 * The snapshot representing the current state of the DisambiguatedProfile.
 */
export interface DisambiguatedProfileViewSnapshot {

    /**
     * The member information for disambiguation.
     */
    member?: MemberInfo | null;
    /** 
     * The fallback name to use if the member's display name is not available.
     */
    fallbackName: string;
    /** 
     * Whether to apply color styling to the display name.
     */
    colored?: boolean;
    /** 
     * Whether to emphasize the display name.
     */
    emphasizeDisplayName?: boolean;
    /** 
     * Whether to show a tooltip with additional information.
     */
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
                mxidElement = <span className={styles.mx_DisambiguatedProfile_mxid}>{identifier}</span>;
            }
            title = _t("timeline|disambiguated_profile", {
                displayName: rawDisplayName,
                matrixId: identifier,
            });
        }

        const displayNameClasses = classNames(colorClass, {
            [styles.mx_DisambiguatedProfile_displayName]: emphasizeDisplayName,
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
