/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useState } from "react";
import classNames from "classnames";
import { type RoomMember } from "matrix-js-sdk/src/matrix";
import LocationIcon from "@vector-im/compound-design-tokens/assets/web/icons/location-pin-solid";

import { getUserNameColorClass } from "../../../utils/FormattingUtils";
import MemberAvatar from "../avatars/MemberAvatar";

interface Props {
    id?: string;
    // renders MemberAvatar when provided
    roomMember?: RoomMember;
    // use member text color as background
    useMemberColor?: boolean;
    tooltip?: ReactNode;
}

/**
 * Wrap with tooltip handlers when
 * tooltip is truthy
 */
const OptionalTooltip: React.FC<{
    tooltip?: ReactNode;
    children: ReactNode;
}> = ({ tooltip, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    if (!tooltip) {
        return <>{children}</>;
    }

    const show = (): void => setIsVisible(true);
    const hide = (): void => setIsVisible(false);
    const toggleVisibility = (e: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
        // stop map from zooming in on click
        e.stopPropagation();
        setIsVisible(!isVisible);
    };

    return (
        <div onMouseEnter={show} onClick={toggleVisibility} onMouseLeave={hide}>
            {children}
            {isVisible && tooltip}
        </div>
    );
};

/**
 * Generic location marker
 */
const Marker = React.forwardRef<HTMLDivElement, Props>(({ id, roomMember, useMemberColor, tooltip }, ref) => {
    const memberColorClass = useMemberColor && roomMember ? getUserNameColorClass(roomMember.userId) : "";
    return (
        <div
            ref={ref}
            id={id}
            className={classNames("mx_Marker", memberColorClass, {
                mx_Marker_defaultColor: !memberColorClass,
            })}
        >
            <OptionalTooltip tooltip={tooltip}>
                <div className="mx_Marker_border">
                    {roomMember ? (
                        <MemberAvatar
                            member={roomMember}
                            size="36px"
                            viewUserOnClick={false}
                            // no mxid on hover when marker has tooltip
                            hideTitle={!!tooltip}
                        />
                    ) : (
                        <LocationIcon className="mx_Marker_icon" />
                    )}
                </div>
            </OptionalTooltip>
        </div>
    );
});

export default Marker;
