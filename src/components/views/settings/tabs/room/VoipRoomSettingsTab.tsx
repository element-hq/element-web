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

import React, { useCallback, useMemo, useState } from "react";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { RoomState } from "matrix-js-sdk/src/models/room-state";
import { Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../../languageHandler";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import SettingsSubsection from "../../shared/SettingsSubsection";
import SettingsTab from "../SettingsTab";
import { ElementCall } from "../../../../../models/Call";
import { useRoomState } from "../../../../../hooks/useRoomState";
import SdkConfig, { DEFAULTS } from "../../../../../SdkConfig";
import { SettingsSection } from "../../shared/SettingsSection";

interface ElementCallSwitchProps {
    room: Room;
}

const ElementCallSwitch: React.FC<ElementCallSwitchProps> = ({ room }) => {
    const isPublic = useMemo(() => room.getJoinRule() === JoinRule.Public, [room]);
    const [content, events, maySend] = useRoomState(
        room,
        useCallback((state: RoomState) => {
            const content = state?.getStateEvents(EventType.RoomPowerLevels, "")?.getContent();
            return [
                content ?? {},
                content?.["events"] ?? {},
                state?.maySendStateEvent(EventType.RoomPowerLevels, MatrixClientPeg.get().getSafeUserId()),
            ];
        }, []),
    );

    const [elementCallEnabled, setElementCallEnabled] = useState<boolean>(() => {
        return events[ElementCall.MEMBER_EVENT_TYPE.name] === 0;
    });

    const onChange = useCallback(
        (enabled: boolean): void => {
            setElementCallEnabled(enabled);

            if (enabled) {
                const userLevel = events[EventType.RoomMessage] ?? content.users_default ?? 0;
                const moderatorLevel = content.kick ?? 50;

                events[ElementCall.CALL_EVENT_TYPE.name] = isPublic ? moderatorLevel : userLevel;
                events[ElementCall.MEMBER_EVENT_TYPE.name] = userLevel;
            } else {
                const adminLevel = events[EventType.RoomPowerLevels] ?? content.state_default ?? 100;

                events[ElementCall.CALL_EVENT_TYPE.name] = adminLevel;
                events[ElementCall.MEMBER_EVENT_TYPE.name] = adminLevel;
            }

            MatrixClientPeg.get().sendStateEvent(room.roomId, EventType.RoomPowerLevels, {
                events: events,
                ...content,
            });
        },
        [room.roomId, content, events, isPublic],
    );

    const brand = SdkConfig.get("element_call").brand ?? DEFAULTS.element_call.brand;

    return (
        <LabelledToggleSwitch
            data-testid="element-call-switch"
            label={_t("Enable %(brand)s as an additional calling option in this room", { brand })}
            caption={_t(
                "%(brand)s is end-to-end encrypted, " + "but is currently limited to smaller numbers of users.",
                { brand },
            )}
            value={elementCallEnabled}
            onChange={onChange}
            disabled={!maySend}
            tooltip={_t("You do not have sufficient permissions to change this.")}
        />
    );
};

interface Props {
    room: Room;
}

export const VoipRoomSettingsTab: React.FC<Props> = ({ room }) => {
    return (
        <SettingsTab>
            <SettingsSection heading={_t("Voice & Video")}>
                <SettingsSubsection heading={_t("Call type")}>
                    <ElementCallSwitch room={room} />
                </SettingsSubsection>
            </SettingsSection>
        </SettingsTab>
    );
};
