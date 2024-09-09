/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useMemo, useState } from "react";
import { JoinRule, EventType, RoomState, Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../../languageHandler";
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
        useCallback(
            (state: RoomState) => {
                const content = state?.getStateEvents(EventType.RoomPowerLevels, "")?.getContent();
                return [
                    content ?? {},
                    content?.["events"] ?? {},
                    state?.maySendStateEvent(EventType.RoomPowerLevels, room.client.getSafeUserId()),
                ];
            },
            [room.client],
        ),
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

            room.client.sendStateEvent(room.roomId, EventType.RoomPowerLevels, {
                events: events,
                ...content,
            });
        },
        [room.client, room.roomId, content, events, isPublic],
    );

    const brand = SdkConfig.get("element_call").brand ?? DEFAULTS.element_call.brand;

    return (
        <LabelledToggleSwitch
            data-testid="element-call-switch"
            label={_t("room_settings|voip|enable_element_call_label", { brand })}
            caption={_t("room_settings|voip|enable_element_call_caption", {
                brand,
            })}
            value={elementCallEnabled}
            onChange={onChange}
            disabled={!maySend}
            tooltip={_t("room_settings|voip|enable_element_call_no_permissions_tooltip")}
        />
    );
};

interface Props {
    room: Room;
}

export const VoipRoomSettingsTab: React.FC<Props> = ({ room }) => {
    return (
        <SettingsTab>
            <SettingsSection heading={_t("settings|voip|title")}>
                <SettingsSubsection heading={_t("room_settings|voip|call_type_section")}>
                    <ElementCallSwitch room={room} />
                </SettingsSubsection>
            </SettingsSection>
        </SettingsTab>
    );
};
