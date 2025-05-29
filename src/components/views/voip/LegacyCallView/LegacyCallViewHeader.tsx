/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import React from "react";

import { _t } from "../../../../languageHandler";
import RoomAvatar from "../../avatars/RoomAvatar";
import AccessibleButton from "../../elements/AccessibleButton";

interface LegacyCallControlsProps {
    onExpand?: () => void;
    onPin?: () => void;
    onMaximize?: () => void;
}

const LegacyCallViewHeaderControls: React.FC<LegacyCallControlsProps> = ({ onExpand, onPin, onMaximize }) => {
    return (
        <div className="mx_LegacyCallViewHeader_controls">
            {onMaximize && (
                <AccessibleButton
                    className="mx_LegacyCallViewHeader_button mx_LegacyCallViewHeader_button_fullscreen"
                    onClick={onMaximize}
                    title={_t("voip|maximise")}
                />
            )}
            {onPin && (
                <AccessibleButton
                    className="mx_LegacyCallViewHeader_button mx_LegacyCallViewHeader_button_pin"
                    onClick={onPin}
                    title={_t("action|pin")}
                />
            )}
            {onExpand && (
                <AccessibleButton
                    className="mx_LegacyCallViewHeader_button mx_LegacyCallViewHeader_button_expand"
                    onClick={onExpand}
                    title={_t("voip|expand")}
                />
            )}
        </div>
    );
};

interface ISecondaryCallInfoProps {
    callRoom: Room;
}

const SecondaryCallInfo: React.FC<ISecondaryCallInfoProps> = ({ callRoom }) => {
    return (
        <span className="mx_LegacyCallViewHeader_secondaryCallInfo">
            <RoomAvatar room={callRoom} size="16px" />
            <span className="mx_LegacyCallView_secondaryCall_roomName">
                {_t("voip|on_hold", { name: callRoom.name })}
            </span>
        </span>
    );
};

interface LegacyCallViewHeaderProps {
    pipMode?: boolean;
    callRooms: [Room, Room | null];
    onPipMouseDown?: (event: React.MouseEvent<Element, MouseEvent>) => void;
    onExpand?: () => void;
    onPin?: () => void;
    onMaximize?: () => void;
}

const LegacyCallViewHeader: React.FC<LegacyCallViewHeaderProps> = ({
    pipMode = false,
    callRooms,
    onPipMouseDown,
    onExpand,
    onPin,
    onMaximize,
}) => {
    const [callRoom, onHoldCallRoom] = callRooms;
    const callRoomName = callRoom.name;

    if (!pipMode) {
        return (
            <div className="mx_LegacyCallViewHeader">
                <div className="mx_LegacyCallViewHeader_icon" />
                <span className="mx_LegacyCallViewHeader_text">{_t("action|call")}</span>
                <LegacyCallViewHeaderControls onMaximize={onMaximize} />
            </div>
        );
    }
    return (
        <div className="mx_LegacyCallViewHeader mx_LegacyCallViewHeader_pip" onMouseDown={onPipMouseDown}>
            <RoomAvatar room={callRoom} size="32px" />
            <div className="mx_LegacyCallViewHeader_callInfo">
                <div className="mx_LegacyCallViewHeader_roomName">{callRoomName}</div>
                {onHoldCallRoom && <SecondaryCallInfo callRoom={onHoldCallRoom} />}
            </div>
            <LegacyCallViewHeaderControls onExpand={onExpand} onPin={onPin} onMaximize={onMaximize} />
        </div>
    );
};

export default LegacyCallViewHeader;
