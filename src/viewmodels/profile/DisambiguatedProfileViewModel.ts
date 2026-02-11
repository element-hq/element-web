/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import {
    BaseViewModel,
    type DisambiguatedProfileViewActions,
    type DisambiguatedProfileViewSnapshot,
    type DisambiguatedProfileViewModel as DisambiguatedProfileViewModelInterface,
} from "@element-hq/web-shared-components";
import { type MouseEvent } from "react";

import { _t } from "../../languageHandler";
import { getUserNameColorClass } from "../../utils/FormattingUtils";
import UserIdentifier from "../../customisations/UserIdentifier";

/**
 * Information about a member for disambiguation purposes.
 */
interface MemberInfo {
    /**
     * The user's Matrix ID.
     */
    userId: string;
    /**
     * The room ID context for disambiguation.
     */
    roomId: string;
    /**
     * The raw display name of the user, if available.
     */
    rawDisplayName?: string;
    /**
     * Whether the user is set to have disambiguation name.
     */
    disambiguate: boolean;
}

/**
 * Props for the DisambiguatedProfileViewModel.
 */
export interface DisambiguatedProfileViewModelProps {
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
    /**
     * Optional click handler for the profile.
     */
    onClick?: DisambiguatedProfileViewActions["onClick"];
    /**
     * Optional CSS class name to apply to the profile.
     */
    className?: string;
}

/**
 * ViewModel for the disambiguated profile, providing the current state of the component.
 * It computes pre-rendered values for the View including color classes, display identifiers, and tooltips.
 */
export class DisambiguatedProfileViewModel
    extends BaseViewModel<DisambiguatedProfileViewSnapshot, DisambiguatedProfileViewModelProps>
    implements DisambiguatedProfileViewModelInterface
{
    private static readonly computeSnapshot = (
        props: DisambiguatedProfileViewModelProps,
    ): DisambiguatedProfileViewSnapshot => {
        const { member, fallbackName, colored, emphasizeDisplayName, withTooltip, className } = props;

        // Compute display name
        const displayName = member?.rawDisplayName || fallbackName;
        const mxid = member?.userId;

        // Compute color class if coloring is enabled
        let colorClass: string | undefined;
        if (colored && mxid) {
            colorClass = getUserNameColorClass(mxid);
        }

        // Compute display identifier for disambiguation
        let displayIdentifier: string | undefined;
        let title: string | undefined;

        if (mxid) {
            const identifier =
                UserIdentifier.getDisplayUserIdentifier?.(mxid, {
                    withDisplayName: true,
                    roomId: member?.roomId,
                }) ?? mxid;

            // Only show identifier if disambiguation is needed
            if (member?.disambiguate) {
                displayIdentifier = identifier;
            }

            // Compute tooltip title if enabled
            if (withTooltip) {
                title = _t("timeline|disambiguated_profile", {
                    displayName,
                    matrixId: identifier,
                });
            }
        }

        return {
            displayName,
            colorClass,
            className,
            displayIdentifier,
            title,
            emphasizeDisplayName,
        };
    };

    public constructor(props: DisambiguatedProfileViewModelProps) {
        super(props, DisambiguatedProfileViewModel.computeSnapshot(props));
    }

    public setMember(fallbackName: string, member?: MemberInfo | null): void {
        this.props.member = member;
        this.props.fallbackName = fallbackName;

        this.snapshot.set(DisambiguatedProfileViewModel.computeSnapshot(this.props));
    }

    public onClick(evt: MouseEvent<HTMLDivElement>): void {
        this.props.onClick?.(evt);
    }
}
