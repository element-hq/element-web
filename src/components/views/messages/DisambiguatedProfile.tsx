/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { getUserNameColorClass } from "../../../utils/FormattingUtils";
import UserIdentifier from "../../../customisations/UserIdentifier";

interface IProps {
    member?: RoomMember | null;
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
            colorClass = getUserNameColorClass(fallbackName);
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
            title = _t("%(displayName)s (%(matrixId)s)", {
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
