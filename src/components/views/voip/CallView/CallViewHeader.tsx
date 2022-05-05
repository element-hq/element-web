/*
Copyright 2021 New Vector Ltd

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

import { Room } from 'matrix-js-sdk/src/models/room';
import React from 'react';

import { _t } from '../../../../languageHandler';
import RoomAvatar from '../../avatars/RoomAvatar';
import AccessibleTooltipButton from '../../elements/AccessibleTooltipButton';

interface CallControlsProps {
    onExpand?: () => void;
    onPin?: () => void;
    onMaximize?: () => void;
}

const CallViewHeaderControls: React.FC<CallControlsProps> = ({ onExpand, onPin, onMaximize }) => {
    return <div className="mx_CallViewHeader_controls">
        { onMaximize && <AccessibleTooltipButton
            className="mx_CallViewHeader_button mx_CallViewHeader_button_fullscreen"
            onClick={onMaximize}
            title={_t("Fill Screen")}
        /> }
        { onPin && <AccessibleTooltipButton
            className="mx_CallViewHeader_button mx_CallViewHeader_button_pin"
            onClick={onPin}
            title={_t("Pin")}
        /> }
        { onExpand && <AccessibleTooltipButton
            className="mx_CallViewHeader_button mx_CallViewHeader_button_expand"
            onClick={onExpand}
            title={_t("Return to call")}
        /> }
    </div>;
};

interface ISecondaryCallInfoProps {
    callRoom: Room;
}

const SecondaryCallInfo: React.FC<ISecondaryCallInfoProps> = ({ callRoom }) => {
    return <span className="mx_CallViewHeader_secondaryCallInfo">
        <RoomAvatar room={callRoom} height={16} width={16} />
        <span className="mx_CallView_secondaryCall_roomName">
            { _t("%(name)s on hold", { name: callRoom.name }) }
        </span>
    </span>;
};

interface CallViewHeaderProps {
    pipMode: boolean;
    callRooms?: Room[];
    onPipMouseDown: (event: React.MouseEvent<Element, MouseEvent>) => void;
    onExpand?: () => void;
    onPin?: () => void;
    onMaximize?: () => void;
}

const CallViewHeader: React.FC<CallViewHeaderProps> = ({
    pipMode = false,
    callRooms = [],
    onPipMouseDown,
    onExpand,
    onPin,
    onMaximize,
}) => {
    const [callRoom, onHoldCallRoom] = callRooms;
    const callRoomName = callRoom.name;

    if (!pipMode) {
        return <div className="mx_CallViewHeader">
            <div className="mx_CallViewHeader_icon" />
            <span className="mx_CallViewHeader_text">{ _t("Call") }</span>
            <CallViewHeaderControls onMaximize={onMaximize} />
        </div>;
    }
    return (
        <div
            className="mx_CallViewHeader mx_CallViewHeader_pip"
            onMouseDown={onPipMouseDown}
        >
            <RoomAvatar room={callRoom} height={32} width={32} />
            <div className="mx_CallViewHeader_callInfo">
                <div className="mx_CallViewHeader_roomName">{ callRoomName }</div>
                { onHoldCallRoom && <SecondaryCallInfo callRoom={onHoldCallRoom} /> }
            </div>
            <CallViewHeaderControls onExpand={onExpand} onPin={onPin} onMaximize={onMaximize} />
        </div>
    );
};

export default CallViewHeader;
