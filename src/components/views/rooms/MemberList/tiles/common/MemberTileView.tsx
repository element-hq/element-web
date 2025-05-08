/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { useEffect, useRef, type JSX } from "react";

import AccessibleButton from "../../../../elements/AccessibleButton";

interface Props {
    avatarJsx: JSX.Element;
    nameJsx: JSX.Element | string;
    onClick: () => void;
    ariaLabel: string;
    presenceJsx?: JSX.Element;
    userLabel?: React.ReactNode;
    iconJsx?: JSX.Element;
    focused?: boolean;
}

export function MemberTileView(props: Props): JSX.Element {
    let userLabelJsx: React.ReactNode;
    if (props.userLabel) {
        userLabelJsx = <div className="mx_MemberTileView_userLabel">{props.userLabel}</div>;
    }
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (props.focused) {
            ref.current?.focus();
        }
    }, [props.focused]);
    return (
        // The wrapping div is required to make the magic mouse listener work, for some reason.
        <div>
            <AccessibleButton
                ref={ref}
                className={classNames("mx_MemberTileView", {
                    mx_MemberTileView_hover: props.focused,
                })}
                onClick={props.onClick}
                aria-label={props.ariaLabel}
                tabIndex={props.focused ? 0 : -1}
                role="gridcell"
            >
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
            </AccessibleButton>
        </div>
    );
}
