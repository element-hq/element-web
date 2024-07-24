/*
Copyright 2019, 2024 New Vector Ltd

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

import React, { createRef } from "react";
import classNames from "classnames";
import { EventType } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Field from "../elements/Field";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import AvatarSetting from "../settings/AvatarSetting";
import { htmlSerializeFromMdIfNeeded } from "../../../editor/serialize";
import { idNameForRoom } from "../avatars/RoomAvatar";

interface IProps {
    roomId: string;
}

interface IState {
    originalDisplayName: string;
    displayName: string;
    originalAvatarUrl: string | null;
    avatarFile: File | null;
    // If true, the user has indicated that they wish to remove the avatar and this should happen on save.
    avatarRemovalPending: boolean;
    originalTopic: string;
    topic: string;
    profileFieldsTouched: Record<string, boolean>;
    canSetName: boolean;
    canSetTopic: boolean;
    canSetAvatar: boolean;
}

// TODO: Merge with ProfileSettings?
export default class RoomProfileSettings extends React.Component<IProps, IState> {
    private avatarUpload = createRef<HTMLInputElement>();

    public constructor(props: IProps) {
        super(props);

        const client = MatrixClientPeg.safeGet();
        const room = client.getRoom(props.roomId);
        if (!room) throw new Error(`Expected a room for ID: ${props.roomId}`);

        const avatarEvent = room.currentState.getStateEvents(EventType.RoomAvatar, "");
        const avatarUrl = avatarEvent?.getContent()["url"] ?? null;

        const topicEvent = room.currentState.getStateEvents(EventType.RoomTopic, "");
        const topic = topicEvent && topicEvent.getContent() ? topicEvent.getContent()["topic"] : "";

        const nameEvent = room.currentState.getStateEvents(EventType.RoomName, "");
        const name = nameEvent && nameEvent.getContent() ? nameEvent.getContent()["name"] : "";

        const userId = client.getSafeUserId();
        this.state = {
            originalDisplayName: name,
            displayName: name,
            originalAvatarUrl: avatarUrl,
            avatarFile: null,
            avatarRemovalPending: false,
            originalTopic: topic,
            topic: topic,
            profileFieldsTouched: {},
            canSetName: room.currentState.maySendStateEvent(EventType.RoomName, userId),
            canSetTopic: room.currentState.maySendStateEvent(EventType.RoomTopic, userId),
            canSetAvatar: room.currentState.maySendStateEvent(EventType.RoomAvatar, userId),
        };
    }

    private onAvatarChanged = (file: File): void => {
        this.setState({
            avatarFile: file,
            avatarRemovalPending: false,
            profileFieldsTouched: {
                ...this.state.profileFieldsTouched,
                avatar: true,
            },
        });
    };

    private removeAvatar = (): void => {
        // clear file upload field so same file can be selected
        if (this.avatarUpload.current) this.avatarUpload.current.value = "";
        this.setState({
            avatarFile: null,
            avatarRemovalPending: true,
            profileFieldsTouched: {
                ...this.state.profileFieldsTouched,
                avatar: true,
            },
        });
    };

    private isSaveEnabled = (): boolean => {
        return Boolean(Object.values(this.state.profileFieldsTouched).length);
    };

    private cancelProfileChanges = async (e: ButtonEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.isSaveEnabled()) return;
        this.setState({
            profileFieldsTouched: {},
            displayName: this.state.originalDisplayName,
            topic: this.state.originalTopic,
            avatarFile: null,
            avatarRemovalPending: false,
        });
    };

    private saveProfile = async (e: React.FormEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.isSaveEnabled()) return;
        this.setState({ profileFieldsTouched: {} });

        const client = MatrixClientPeg.safeGet();
        const newState: Partial<IState> = {};

        // TODO: What do we do about errors?
        const displayName = this.state.displayName.trim();
        if (this.state.originalDisplayName !== this.state.displayName) {
            await client.setRoomName(this.props.roomId, displayName);
            newState.originalDisplayName = displayName;
            newState.displayName = displayName;
        }

        if (this.state.avatarFile) {
            const { content_uri: uri } = await client.uploadContent(this.state.avatarFile);
            await client.sendStateEvent(this.props.roomId, EventType.RoomAvatar, { url: uri }, "");
            newState.originalAvatarUrl = uri;
            newState.avatarFile = null;
        } else if (this.state.avatarRemovalPending) {
            await client.sendStateEvent(this.props.roomId, EventType.RoomAvatar, {}, "");
            newState.avatarRemovalPending = false;
            newState.originalAvatarUrl = null;
        }

        if (this.state.originalTopic !== this.state.topic) {
            const html = htmlSerializeFromMdIfNeeded(this.state.topic, { forceHTML: false });
            await client.setRoomTopic(this.props.roomId, this.state.topic, html);
            newState.originalTopic = this.state.topic;
        }

        this.setState(newState as IState);
    };

    private onDisplayNameChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ displayName: e.target.value });
        if (this.state.originalDisplayName === e.target.value) {
            this.setState({
                profileFieldsTouched: {
                    ...this.state.profileFieldsTouched,
                    name: false,
                },
            });
        } else {
            this.setState({
                profileFieldsTouched: {
                    ...this.state.profileFieldsTouched,
                    name: true,
                },
            });
        }
    };

    private onTopicChanged = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({ topic: e.target.value });
        if (this.state.originalTopic === e.target.value) {
            this.setState({
                profileFieldsTouched: {
                    ...this.state.profileFieldsTouched,
                    topic: false,
                },
            });
        } else {
            this.setState({
                profileFieldsTouched: {
                    ...this.state.profileFieldsTouched,
                    topic: true,
                },
            });
        }
    };

    public render(): React.ReactNode {
        let profileSettingsButtons;
        if (this.state.canSetName || this.state.canSetTopic || this.state.canSetAvatar) {
            profileSettingsButtons = (
                <div className="mx_RoomProfileSettings_buttons">
                    <AccessibleButton
                        onClick={this.cancelProfileChanges}
                        kind="primary_outline"
                        disabled={!this.isSaveEnabled()}
                    >
                        {_t("action|cancel")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this.saveProfile} kind="primary" disabled={!this.isSaveEnabled()}>
                        {_t("action|save")}
                    </AccessibleButton>
                </div>
            );
        }

        const canRemove = this.state.profileFieldsTouched.avatar
            ? Boolean(this.state.avatarFile)
            : Boolean(this.state.originalAvatarUrl);

        return (
            <form onSubmit={this.saveProfile} autoComplete="off" noValidate={true} className="mx_RoomProfileSettings">
                <div className="mx_RoomProfileSettings_profile">
                    <div className="mx_RoomProfileSettings_profile_controls">
                        <Field
                            label={_t("room_settings|general|name_field_label")}
                            type="text"
                            value={this.state.displayName}
                            autoComplete="off"
                            onChange={this.onDisplayNameChanged}
                            disabled={!this.state.canSetName}
                        />
                        <Field
                            className={classNames(
                                "mx_RoomProfileSettings_profile_controls_topic",
                                "mx_RoomProfileSettings_profile_controls_topic--room",
                            )}
                            id="profileTopic" // See: NewRoomIntro.tsx
                            label={_t("room_settings|general|topic_field_label")}
                            disabled={!this.state.canSetTopic}
                            type="text"
                            value={this.state.topic}
                            autoComplete="off"
                            onChange={this.onTopicChanged}
                            element="textarea"
                        />
                    </div>
                    <AvatarSetting
                        avatar={
                            this.state.avatarRemovalPending
                                ? undefined
                                : (this.state.avatarFile ?? this.state.originalAvatarUrl ?? undefined)
                        }
                        avatarAltText={_t("room_settings|general|avatar_field_label")}
                        disabled={!this.state.canSetAvatar}
                        onChange={this.onAvatarChanged}
                        removeAvatar={canRemove ? this.removeAvatar : undefined}
                        placeholderId={idNameForRoom(MatrixClientPeg.safeGet().getRoom(this.props.roomId)!)}
                        placeholderName={MatrixClientPeg.safeGet().getRoom(this.props.roomId)!.name}
                    />
                </div>
                {profileSettingsButtons}
            </form>
        );
    }
}
