/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, useCallback, useMemo, useState } from "react";
import { JoinRule, EventType, type RoomState, type Room } from "matrix-js-sdk/src/matrix";
import { type RoomPowerLevelsEventContent } from "matrix-js-sdk/src/types";
import { Form, SettingsToggleInput } from "@vector-im/compound-web";

import { _t } from "../../../../../languageHandler";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
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
    const [content, maySend] = useRoomState(
        room,
        useCallback(
            (state: RoomState) => {
                const content = state
                    ?.getStateEvents(EventType.RoomPowerLevels, "")
                    ?.getContent<RoomPowerLevelsEventContent>();
                return [
                    content ?? {},
                    state?.maySendStateEvent(EventType.RoomPowerLevels, room.client.getSafeUserId()),
                ] as const;
            },
            [room.client],
        ),
    );

    const [elementCallEnabled, setElementCallEnabled] = useState<boolean>(() => {
        return content.events?.[ElementCall.MEMBER_EVENT_TYPE.name] === 0;
    });

    const onChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (evt): void => {
            const enabled = evt.target.checked;
            setElementCallEnabled(enabled);

            // Take a copy to avoid mutating the original
            const newContent = { events: {}, ...content };

            if (enabled) {
                const userLevel = newContent.events[EventType.RoomMessage] ?? content.users_default ?? 0;
                const moderatorLevel = content.kick ?? 50;

                newContent.events[ElementCall.CALL_EVENT_TYPE.name] = isPublic ? moderatorLevel : userLevel;
                newContent.events[ElementCall.MEMBER_EVENT_TYPE.name] = userLevel;
            } else {
                const adminLevel = newContent.events[EventType.RoomPowerLevels] ?? content.state_default ?? 100;

                newContent.events[ElementCall.CALL_EVENT_TYPE.name] = adminLevel;
                newContent.events[ElementCall.MEMBER_EVENT_TYPE.name] = adminLevel;
            }

            room.client.sendStateEvent(room.roomId, EventType.RoomPowerLevels, newContent);
        },
        [room.client, room.roomId, content, isPublic],
    );

    const brand = SdkConfig.get("element_call").brand ?? DEFAULTS.element_call.brand;

    return (
        <SettingsToggleInput
            name="element-call-switch"
            label={_t("room_settings|voip|enable_element_call_label", { brand })}
            helpMessage={_t("room_settings|voip|enable_element_call_caption", {
                brand,
            })}
            checked={elementCallEnabled}
            onChange={onChange}
            disabled={!maySend}
            disabledMessage={_t("room_settings|voip|enable_element_call_no_permissions_tooltip")}
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
                <Form.Root onSubmit={(evt) => {evt.preventDefault(); evt.stopPropagation();}}>
                    <SettingsSubsection heading={_t("room_settings|voip|call_type_section")}>
                        <ElementCallSwitch room={room} />
                    </SettingsSubsection>
                </Form.Root>
            </SettingsSection>
        </SettingsTab>
    );
};
