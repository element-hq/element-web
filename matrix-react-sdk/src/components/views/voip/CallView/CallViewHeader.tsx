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

import { CallType } from 'matrix-js-sdk/src/webrtc/call';
import { Room } from 'matrix-js-sdk/src/models/room';
import React from 'react';
import classNames from 'classnames';

import { _t, _td } from '../../../../languageHandler';
import RoomAvatar from '../../avatars/RoomAvatar';
import dis from '../../../../dispatcher/dispatcher';
import { Action } from '../../../../dispatcher/actions';
import AccessibleTooltipButton from '../../elements/AccessibleTooltipButton';

const callTypeTranslationByType: Record<CallType, string> = {
    [CallType.Video]: _td("Video Call"),
    [CallType.Voice]: _td("Voice Call"),
};

interface CallViewHeaderProps {
    pipMode: boolean;
    type: CallType;
    callRooms?: Room[];
    onPipMouseDown: (event: React.MouseEvent<Element, MouseEvent>) => void;
}

const onFullscreenClick = () => {
    dis.dispatch({
        action: 'video_fullscreen',
        fullscreen: true,
    });
};

const onExpandClick = (roomId: string) => {
    dis.dispatch({
        action: Action.ViewRoom,
        room_id: roomId,
    });
};

type CallControlsProps = Pick<CallViewHeaderProps, 'pipMode' | 'type'> & {
    roomId: string;
};
const CallViewHeaderControls: React.FC<CallControlsProps> = ({ pipMode = false, type, roomId }) => {
    return <div className="mx_CallViewHeader_controls">
        { !pipMode && <AccessibleTooltipButton
            className="mx_CallViewHeader_button mx_CallViewHeader_button_fullscreen"
            onClick={onFullscreenClick}
            title={_t("Fill Screen")}
        /> }
        { pipMode && <AccessibleTooltipButton
            className="mx_CallViewHeader_button mx_CallViewHeader_button_expand"
            onClick={() => onExpandClick(roomId)}
            title={_t("Return to call")}
        /> }
    </div>;
};
const SecondaryCallInfo: React.FC<{ callRoom: Room }> = ({ callRoom }) => {
    return <span className="mx_CallViewHeader_secondaryCallInfo">
        <RoomAvatar room={callRoom} height={16} width={16} />
        <span className="mx_CallView_secondaryCall_roomName">
            { _t("%(name)s on hold", { name: callRoom.name }) }
        </span>
    </span>;
};

const CallTypeIcon: React.FC<{ type: CallType }> = ({ type }) => {
    const classes = classNames({
        'mx_CallViewHeader_callTypeIcon': true,
        'mx_CallViewHeader_callTypeIcon_video': type === CallType.Video,
        'mx_CallViewHeader_callTypeIcon_voice': type === CallType.Voice,
    });
    return <div className={classes} />;
};

const CallViewHeader: React.FC<CallViewHeaderProps> = ({
    type,
    pipMode = false,
    callRooms = [],
    onPipMouseDown,
}) => {
    const [callRoom, onHoldCallRoom] = callRooms;
    const callTypeText = _t(callTypeTranslationByType[type]);
    const callRoomName = callRoom.name;
    const { roomId } = callRoom;

    if (!pipMode) {
        return <div className="mx_CallViewHeader">
            <CallTypeIcon type={type} />
            <span className="mx_CallViewHeader_callType">{ callTypeText }</span>
            <CallViewHeaderControls roomId={roomId} pipMode={pipMode} type={type} />
        </div>;
    }
    return (
        <div
            className="mx_CallViewHeader"
            onMouseDown={onPipMouseDown}
        >
            <RoomAvatar room={callRoom} height={32} width={32} />
            <div className="mx_CallViewHeader_callInfo">
                <div className="mx_CallViewHeader_roomName">{ callRoomName }</div>
                <div className="mx_CallViewHeader_callTypeSmall">
                    { callTypeText }
                    { onHoldCallRoom && <SecondaryCallInfo callRoom={onHoldCallRoom} /> }
                </div>
            </div>
            <CallViewHeaderControls roomId={roomId} pipMode={pipMode} type={type} />
        </div>
    );
};

export default CallViewHeader;
