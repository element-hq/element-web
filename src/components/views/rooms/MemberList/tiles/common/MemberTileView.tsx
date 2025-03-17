/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { RovingAccessibleButton } from "../../../../../../accessibility/RovingTabIndex";

interface Props {
    avatarJsx: JSX.Element;
    nameJsx: JSX.Element | string;
    onClick: () => void;
    title?: string;
    presenceJsx?: JSX.Element;
    userLabel?: React.ReactNode;
    iconJsx?: JSX.Element;
}

export function MemberTileView(props: Props): JSX.Element {
    let userLabelJsx: React.ReactNode;
    if (props.userLabel) {
        userLabelJsx = <div className="mx_MemberTileView_userLabel">{props.userLabel}</div>;
    }

    return (
        // The wrapping div is required to make the magic mouse listener work, for some reason.
        <div>
            <RovingAccessibleButton className="mx_MemberTileView" title={props.title} onClick={props.onClick}>
                <div className="mx_MemberTileView_left">
                    <div className="mx_MemberTileView_avatar">
                        {props.avatarJsx} {props.presenceJsx}
                    </div>
                    <div className="mx_MemberTileView_name">{props.nameJsx}</div>
                </div>
                <div className="mx_MemberTileView_right">
                    {userLabelJsx}
                    {props.iconJsx}
                </div>
            </RovingAccessibleButton>
        </div>
    );
}
