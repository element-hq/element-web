/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import AccessibleButton from "../../../../elements/AccessibleButton";

interface Props {
    avatarJsx: JSX.Element;
    nameJsx: JSX.Element | string;
    onClick: () => void;
    title?: string;
    presenceJsx?: JSX.Element;
    userLabelJsx?: JSX.Element;
    e2eIconJsx?: JSX.Element;
}

export function MemberTileLayout(props: Props): JSX.Element {
    return (
        // The wrapping div is required to make the magic mouse listener work, for some reason.
        <div>
            <AccessibleButton className="mx_MemberTileView" title={props.title} onClick={props.onClick}>
                <div className="mx_MemberTileView_left">
                    <div className="mx_MemberTileView_avatar">
                        {props.avatarJsx} {props.presenceJsx}
                    </div>
                    <div className="mx_MemberTileView_name">{props.nameJsx}</div>
                </div>
                <div className="mx_MemberTileView_right">
                    {props.userLabelJsx}
                    {props.e2eIconJsx}
                </div>
            </AccessibleButton>
        </div>
    );
}
