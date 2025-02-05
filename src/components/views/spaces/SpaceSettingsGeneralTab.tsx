/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";
import { type Room, EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import SpaceBasicSettings from "./SpaceBasicSettings";
import { avatarUrlForRoom } from "../../../Avatar";
import { htmlSerializeFromMdIfNeeded } from "../../../editor/serialize";
import { leaveSpace } from "../../../utils/leave-behaviour";
import { getTopic } from "../../../hooks/room/useTopic";
import SettingsTab from "../settings/tabs/SettingsTab";
import { SettingsSection } from "../settings/shared/SettingsSection";
import { SettingsSubsection } from "../settings/shared/SettingsSubsection";

interface IProps {
    matrixClient: MatrixClient;
    space: Room;
}

const SpaceSettingsGeneralTab: React.FC<IProps> = ({ matrixClient: cli, space }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const userId = cli.getUserId()!;

    const [newAvatar, setNewAvatar] = useState<File | null | undefined>(null); // undefined means to remove avatar
    const canSetAvatar = space.currentState.maySendStateEvent(EventType.RoomAvatar, userId);
    const avatarChanged = newAvatar !== null;

    const [name, setName] = useState<string>(space.name);
    const canSetName = space.currentState.maySendStateEvent(EventType.RoomName, userId);
    const nameChanged = name !== space.name;

    const currentTopic = getTopic(space)?.text ?? "";
    const [topic, setTopic] = useState(currentTopic);
    const canSetTopic = space.currentState.maySendStateEvent(EventType.RoomTopic, userId);
    const topicChanged = topic !== currentTopic;

    const onCancel = (): void => {
        setNewAvatar(null);
        setName(space.name);
        setTopic(currentTopic);
    };

    const onSave = async (): Promise<void> => {
        setBusy(true);
        const promises: Promise<unknown>[] = [];

        if (avatarChanged) {
            if (newAvatar) {
                promises.push(
                    (async (): Promise<void> => {
                        const { content_uri: url } = await cli.uploadContent(newAvatar);
                        await cli.sendStateEvent(space.roomId, EventType.RoomAvatar, { url }, "");
                    })(),
                );
            } else {
                promises.push(cli.sendStateEvent(space.roomId, EventType.RoomAvatar, {}, ""));
            }
        }

        if (nameChanged) {
            promises.push(cli.setRoomName(space.roomId, name));
        }

        if (topicChanged) {
            const htmlTopic = htmlSerializeFromMdIfNeeded(topic, { forceHTML: false });
            promises.push(cli.setRoomTopic(space.roomId, topic, htmlTopic));
        }

        const results = await Promise.allSettled(promises);
        setBusy(false);
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
            logger.error("Failed to save space settings: ", failures);
            setError(_t("room_settings|general|error_save_space_settings"));
        }
    };

    return (
        <SettingsTab>
            <SettingsSection heading={_t("common|general")}>
                <div>
                    <div>{_t("room_settings|general|description_space")}</div>

                    {error && <div className="mx_SpaceRoomView_errorText">{error}</div>}

                    <SpaceBasicSettings
                        avatarUrl={avatarUrlForRoom(space, 80, 80, "crop") ?? undefined}
                        avatarDisabled={busy || !canSetAvatar}
                        setAvatar={setNewAvatar}
                        name={name}
                        nameDisabled={busy || !canSetName}
                        setName={setName}
                        topic={topic}
                        topicDisabled={busy || !canSetTopic}
                        setTopic={setTopic}
                    />

                    <AccessibleButton
                        onClick={onCancel}
                        disabled={busy || !(avatarChanged || nameChanged || topicChanged)}
                        kind="link"
                    >
                        {_t("action|cancel")}
                    </AccessibleButton>
                    <AccessibleButton onClick={onSave} disabled={busy} kind="primary">
                        {busy ? _t("common|saving") : _t("room_settings|general|save")}
                    </AccessibleButton>
                </div>

                <SettingsSubsection heading={_t("room_settings|general|leave_space")}>
                    <AccessibleButton
                        kind="danger"
                        onClick={() => {
                            leaveSpace(space);
                        }}
                    >
                        {_t("room_settings|general|leave_space")}
                    </AccessibleButton>
                </SettingsSubsection>
            </SettingsSection>
        </SettingsTab>
    );
};

export default SpaceSettingsGeneralTab;
