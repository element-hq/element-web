/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, {useState} from 'react';
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixClient} from "matrix-js-sdk/src/client";
import {EventType} from "matrix-js-sdk/src/@types/event";

import {_t} from '../../../languageHandler';
import {IDialogProps} from "./IDialogProps";
import BaseDialog from "./BaseDialog";
import DevtoolsDialog from "./DevtoolsDialog";
import SpaceBasicSettings from '../spaces/SpaceBasicSettings';
import {getTopic} from "../elements/RoomTopic";
import {avatarUrlForRoom} from "../../../Avatar";
import ToggleSwitch from "../elements/ToggleSwitch";
import AccessibleButton from "../elements/AccessibleButton";
import FormButton from "../elements/FormButton";
import Modal from "../../../Modal";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {allSettled} from "../../../utils/promise";
import {useDispatcher} from "../../../hooks/useDispatcher";

interface IProps extends IDialogProps {
    matrixClient: MatrixClient;
    space: Room;
}

const SpaceSettingsDialog: React.FC<IProps> = ({ matrixClient: cli, space, onFinished }) => {
    useDispatcher(defaultDispatcher, ({action, ...params}) => {
        if (action === "after_leave_room" && params.room_id === space.roomId) {
            onFinished(false);
        }
    });

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const userId = cli.getUserId();

    const [newAvatar, setNewAvatar] = useState<File>(null); // undefined means to remove avatar
    const canSetAvatar = space.currentState.maySendStateEvent(EventType.RoomAvatar, userId);
    const avatarChanged = newAvatar !== null;

    const [name, setName] = useState<string>(space.name);
    const canSetName = space.currentState.maySendStateEvent(EventType.RoomName, userId);
    const nameChanged = name !== space.name;

    const currentTopic = getTopic(space);
    const [topic, setTopic] = useState<string>(currentTopic);
    const canSetTopic = space.currentState.maySendStateEvent(EventType.RoomTopic, userId);
    const topicChanged = topic !== currentTopic;

    const currentJoinRule = space.getJoinRule();
    const [joinRule, setJoinRule] = useState(currentJoinRule);
    const canSetJoinRule = space.currentState.maySendStateEvent(EventType.RoomJoinRules, userId);
    const joinRuleChanged = joinRule !== currentJoinRule;

    const onSave = async () => {
        setBusy(true);
        const promises = [];

        if (avatarChanged) {
            promises.push(cli.sendStateEvent(space.roomId, EventType.RoomAvatar, {
                url: await cli.uploadContent(newAvatar),
            }, ""));
        }

        if (nameChanged) {
            promises.push(cli.setRoomName(space.roomId, name));
        }

        if (topicChanged) {
            promises.push(cli.setRoomTopic(space.roomId, topic));
        }

        if (joinRuleChanged) {
            promises.push(cli.sendStateEvent(space.roomId, EventType.RoomJoinRules, { join_rule: joinRule }, ""));
        }

        const results = await allSettled(promises);
        setBusy(false);
        const failures = results.filter(r => r.status === "rejected");
        if (failures.length > 0) {
            console.error("Failed to save space settings: ", failures);
            setError(_t("Failed to save space settings."));
        }
    };

    return <BaseDialog
        title={_t("Space settings")}
        className="mx_SpaceSettingsDialog"
        contentId="mx_SpaceSettingsDialog"
        onFinished={onFinished}
        fixedWidth={false}
    >
        <div className="mx_SpaceSettingsDialog_content" id="mx_SpaceSettingsDialog">
            <div>{ _t("Edit settings relating to your space.") }</div>

            { error && <div className="mx_SpaceRoomView_errorText">{ error }</div> }

            <SpaceBasicSettings
                avatarUrl={avatarUrlForRoom(space, 80, 80, "crop")}
                avatarDisabled={!canSetAvatar}
                setAvatar={setNewAvatar}
                name={name}
                nameDisabled={!canSetName}
                setName={setName}
                topic={topic}
                topicDisabled={!canSetTopic}
                setTopic={setTopic}
            />

            <div>
                { _t("Make this space private") }
                <ToggleSwitch
                    checked={joinRule === "private"}
                    onChange={checked => setJoinRule(checked ? "private" : "invite")}
                    disabled={!canSetJoinRule}
                    aria-label={_t("Make this space private")}
                />
            </div>

            <FormButton
                kind="danger"
                label={_t("Leave Space")}
                onClick={() => {
                    defaultDispatcher.dispatch({
                        action: "leave_room",
                        room_id: space.roomId,
                    });
                }}
            />

            <div className="mx_SpaceSettingsDialog_buttons">
                <AccessibleButton onClick={() => Modal.createDialog(DevtoolsDialog, {roomId: space.roomId})}>
                    { _t("View dev tools") }
                </AccessibleButton>
                <AccessibleButton onClick={onFinished} disabled={busy} kind="link">
                    { _t("Cancel") }
                </AccessibleButton>
                <FormButton onClick={onSave} disabled={busy} label={busy ? _t("Saving...") : _t("Save Changes")} />
            </div>
        </div>
    </BaseDialog>;
};

export default SpaceSettingsDialog;

