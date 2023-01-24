/*
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

import React, { ReactNode, useState } from "react";
import classNames from "classnames";
import { RoomMember } from "matrix-js-sdk/src/matrix";

import { Icon as LocationIcon } from "../../../../res/img/element-icons/location.svg";
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
                            width={36}
                            height={36}
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
