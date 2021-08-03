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
import { isUndefined } from 'lodash';
import { _t } from '../../../../languageHandler';
import RoomAvatar from '../../avatars/RoomAvatar';
import AccessibleButton from '../../elements/AccessibleButton';
import dis from '../../../../dispatcher/dispatcher';
import WidgetAvatar from '../../avatars/WidgetAvatar';
import { IApp } from '../../../../stores/WidgetStore';
import WidgetUtils from '../../../../utils/WidgetUtils';

const callTypeTranslationByType: Record<CallType | 'widget', (app?: IApp) => string> = {
  [CallType.Video]: () => _t("Video Call"),
  [CallType.Voice]: () => _t("Voice Call"),
  'widget': (app: IApp) => WidgetUtils.getWidgetName(app),
};

interface CallViewHeaderProps {
  pipMode: boolean;
  type: CallType | 'widget';
  callRooms?: Room[];
  app?: IApp;
  onPipMouseDown: (event: React.MouseEvent<Element, MouseEvent>) => void;
}

const onRoomAvatarClick = (roomId: string) => {
    dis.dispatch({
    action: 'view_room',
    room_id: roomId,
    });
};

const onFullscreenClick = () => {
    dis.dispatch({
    action: 'video_fullscreen',
    fullscreen: true,
    });
};

const onExpandClick = (roomId: string) => {
    dis.dispatch({
    action: 'view_room',
    room_id: roomId,
    });
};

type CallControlsProps = Pick<CallViewHeaderProps, 'pipMode' | 'type'> & {
  roomId: string;
};
function CallControls({ pipMode = false, type, roomId }: CallControlsProps) {
    return <div className="mx_CallView_header_controls">
        { (pipMode && type === CallType.Video) &&
      <div className="mx_CallView_header_button mx_CallView_header_button_fullscreen"
          onClick={onFullscreenClick}
          title={_t("Fill Screen")}
      /> }
        { pipMode && <div className="mx_CallView_header_button mx_CallView_header_button_expand"
            onClick={() => onExpandClick(roomId)}
            title={_t("Return to call")}
        /> }
    </div>;
}
function SecondaryCallInfo({ callRoom }: {callRoom: Room}) {
    return <span className="mx_CallView_header_secondaryCallInfo">
        <AccessibleButton element='span' onClick={() => onRoomAvatarClick(callRoom.roomId)}>
            <RoomAvatar room={callRoom} height={16} width={16} />
            <span className="mx_CallView_secondaryCall_roomName">
                { _t("%(name)s on hold", { name: callRoom.name }) }
            </span>
        </AccessibleButton>
    </span>;
}

function getAvatarBasedOnRoomType(roomOrWidget: Room | IApp) {
    if (roomOrWidget instanceof Room) {
        return <RoomAvatar room={roomOrWidget} height={32} width={32} />;
    } else if (!isUndefined(roomOrWidget)) {
        return <WidgetAvatar app={roomOrWidget} height={32} width={32} />;
    }
    return null;
}

export const CallViewHeader: React.FC<CallViewHeaderProps> = ({
  type,
  pipMode = false,
  callRooms = [],
  app,
  onPipMouseDown,
}) {
    const [callRoom, onHoldCallRoom] = callRooms;
    const callTypeText = callTypeTranslationByType[type](app);
    const avatar = getAvatarBasedOnRoomType(callRoom ?? app);
    const callRoomName = type === 'widget' ? callTypeText : callRoom.name;
    const roomId = app ? app.roomId : callRoom.roomId;
    if (!pipMode) {
        return <div className="mx_CallView_header">
            <div className="mx_CallView_header_phoneIcon" />
            <span className="mx_CallView_header_callType">{ callTypeText }</span>
            <CallControls roomId={roomId} pipMode={pipMode} type={type} />
        </div>;
    }
    return (<div
        className="mx_CallView_header"
        onMouseDown={onPipMouseDown}
    >
        <AccessibleButton onClick={() => onRoomAvatarClick(roomId)}>
            { avatar }
        </AccessibleButton>
        <div className="mx_CallView_header_callInfo">
            <div className="mx_CallView_header_roomName">{ callRoomName }</div>
            <div className="mx_CallView_header_callTypeSmall">
                { callTypeText }
                { onHoldCallRoom && <SecondaryCallInfo callRoom={onHoldCallRoom} /> }
            </div>
        </div>
        <CallControls roomId={roomId} pipMode={pipMode} type={type} />
    </div>
    );
}
