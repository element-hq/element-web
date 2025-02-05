/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, type HTMLAttributes, type ReactNode } from "react";
import { type RoomMember } from "matrix-js-sdk/src/matrix";
import { AvatarStack, Tooltip } from "@vector-im/compound-web";
import classNames from "classnames";

import MemberAvatar from "../avatars/MemberAvatar";
import AccessibleButton, { type ButtonEvent } from "./AccessibleButton";
import { useToggled } from "../rooms/RoomHeader/toggle/useToggled";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";

interface IProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
    members: RoomMember[];
    size: string;
    overflow: boolean;
    tooltipLabel?: string;
    tooltipShortcut?: string;
    children?: ReactNode;
    viewUserOnClick?: boolean;
    onClick?: (e: ButtonEvent) => void | Promise<void>;
}

/**
 * A component which displays a list of avatars in a row, with a tooltip showing the names of the users.
 *
 * Any additional props, not named explicitly here, are passed to the underlying {@link AccessibleButton}.
 */
const FacePile: FC<IProps> = ({
    members,
    size,
    overflow,
    tooltipLabel,
    tooltipShortcut,
    children,
    viewUserOnClick = true,
    onClick,
    ...props
}) => {
    const faces = members.map(
        tooltipLabel
            ? (m) => <MemberAvatar key={m.userId} member={m} size={size} hideTitle />
            : (m) => (
                  <Tooltip key={m.userId} label={m.name} caption={tooltipShortcut}>
                      <MemberAvatar member={m} size={size} viewUserOnClick={!onClick && viewUserOnClick} hideTitle />
                  </Tooltip>
              ),
    );

    const pileContents = (
        <>
            {faces}
            {overflow ? <span className="mx_FacePile_more" /> : null}
        </>
    );

    const toggled = useToggled(RightPanelPhases.MemberList);
    const classes = classNames({
        mx_FacePile: true,
        mx_FacePile_toggled: toggled,
    });

    const content = (
        <AccessibleButton {...props} className={classes} onClick={onClick ?? null}>
            <AvatarStack>{pileContents}</AvatarStack>
            {children}
        </AccessibleButton>
    );

    return tooltipLabel ? (
        <Tooltip label={tooltipLabel} caption={tooltipShortcut}>
            {content}
        </Tooltip>
    ) : (
        content
    );
};

export default FacePile;
