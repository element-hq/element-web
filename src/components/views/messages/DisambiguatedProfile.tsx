/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import { RoomMember } from 'matrix-js-sdk/src/models/room-member';
import classNames from 'classnames';

import { getUserNameColorClass } from '../../../utils/FormattingUtils';
import UserIdentifier from "../../../customisations/UserIdentifier";

interface IProps {
    member?: RoomMember;
    fallbackName: string;
    onClick?(): void;
    colored?: boolean;
    emphasizeDisplayName?: boolean;
}

export default class DisambiguatedProfile extends React.Component<IProps> {
    render() {
        const { fallbackName, member, colored, emphasizeDisplayName, onClick } = this.props;
        const rawDisplayName = member?.rawDisplayName || fallbackName;
        const mxid = member?.userId;

        let colorClass;
        if (colored) {
            colorClass = getUserNameColorClass(fallbackName);
        }

        let mxidElement;
        if (member?.disambiguate && mxid) {
            mxidElement = (
                <span className="mx_DisambiguatedProfile_mxid">
                    { UserIdentifier.getDisplayUserIdentifier(
                        mxid, { withDisplayName: true, roomId: member.roomId },
                    ) }
                </span>
            );
        }

        const displayNameClasses = classNames({
            "mx_DisambiguatedProfile_displayName": emphasizeDisplayName,
            [colorClass]: true,
        });

        return (
            <div className="mx_DisambiguatedProfile" onClick={onClick}>
                <span className={displayNameClasses} dir="auto">
                    { rawDisplayName }
                </span>
                { mxidElement }
            </div>
        );
    }
}
