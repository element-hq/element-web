/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { getUserNameColorClass } from "../../../utils/FormattingUtils";
import UserIdentifier from "../../../customisations/UserIdentifier";

interface MemberInfo {
    userId: string;
    roomId: string;
    rawDisplayName?: string;
    disambiguate: boolean;
}

interface IProps {
    member?: MemberInfo | null;
    fallbackName: string;
    onClick?(): void;
    colored?: boolean;
    emphasizeDisplayName?: boolean;
    withTooltip?: boolean;
}

export default class DisambiguatedProfile extends React.Component<IProps> {
    public render(): React.ReactNode {
        const { fallbackName, member, colored, emphasizeDisplayName, withTooltip, onClick } = this.props;
        const rawDisplayName = member?.rawDisplayName || fallbackName;
        const mxid = member?.userId;

        let colorClass: string | undefined;
        if (colored) {
            colorClass = getUserNameColorClass(mxid ?? "");
        }

        let mxidElement;
        let title: string | undefined;

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
            <div className="mx_DisambiguatedProfile" title={withTooltip ? title : undefined} onClick={onClick}>
                <span className={displayNameClasses} dir="auto">
                    {rawDisplayName}
                </span>
                {mxidElement}
            </div>
        );
    }
}
