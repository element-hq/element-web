/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import DisambiguatedProfile from "../messages/DisambiguatedProfile";
import { RoomMember } from "../../../models/rooms/RoomMember";
import MemberAvatarNext from "../avatars/MemberAvatarView";
import useMemberTileViewModel from "../../viewmodels/MemberTileViewModel";
import E2EIcon from "./E2EIconView";
import AvatarPresenceIconView from "./PresenceIconView";
import AccessibleButton from "../elements/AccessibleButton";

interface IProps {
    member: RoomMember;
    showPresence?: boolean;
}

export default function MemberTileView(props: IProps): JSX.Element {
    const vm = useMemberTileViewModel(props);
    const member = vm.member;
    const av = <MemberAvatarNext member={member} size="32px" aria-hidden="true" />;

    const name = vm.name;
    const nameJSX = <DisambiguatedProfile member={member} fallbackName={name || ""} />;

    const presenceState = member.presenceState;
    const presenceJSX = vm.showPresence && presenceState && <AvatarPresenceIconView presenceState={presenceState} />;

    let userLabelJSX;
    if (vm.userLabel) {
        userLabelJSX = <div className="mx_MemberTileView_user_label">{vm.userLabel}</div>;
    }

    let e2eIcon;
    if (vm.e2eStatus) {
        e2eIcon = <E2EIcon isUser={true} status={vm.e2eStatus} />;
    }

    // The wrapping div is required to make the magic mouse listener work, for some reason.
    return (
        <div>
            <AccessibleButton className="mx_MemberTileView" title={vm.title} onClick={vm.onClick}>
                <div className="mx_MemberTileView_left">
                    <div className="mx_MemberTileView_avatar">
                        {av} {presenceJSX}
                    </div>
                    <div className="mx_MemberTileView_name">{nameJSX}</div>
                </div>
                <div className="mx_MemberTileView_right">
                    {userLabelJSX}
                    {e2eIcon}
                </div>
            </AccessibleButton>
        </div>
    );
}
