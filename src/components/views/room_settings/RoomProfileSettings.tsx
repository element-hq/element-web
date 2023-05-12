/*
Copyright 2019 New Vector Ltd

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
import { mediaFromMxc } from "../../../customisations/Media";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import AvatarSetting from "../settings/AvatarSetting";
import { htmlSerializeFromMdIfNeeded } from "../../../editor/serialize";
import { chromeFileInputFix } from "../../../utils/BrowserWorkarounds";

interface IProps {
    roomId: string;
}

interface IState {
    originalDisplayName: string;
    displayName: string;
    originalAvatarUrl: string | null;
    avatarUrl: string | null;
    avatarFile: File | null;
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

        const client = MatrixClientPeg.get();
        const room = client.getRoom(props.roomId);
        if (!room) throw new Error(`Expected a room for ID: ${props.roomId}`);

        const avatarEvent = room.currentState.getStateEvents(EventType.RoomAvatar, "");
        let avatarUrl = avatarEvent?.getContent()["url"] ?? null;
        if (avatarUrl) avatarUrl = mediaFromMxc(avatarUrl).getSquareThumbnailHttp(96);

        const topicEvent = room.currentState.getStateEvents(EventType.RoomTopic, "");
        const topic = topicEvent && topicEvent.getContent() ? topicEvent.getContent()["topic"] : "";

        const nameEvent = room.currentState.getStateEvents(EventType.RoomName, "");
        const name = nameEvent && nameEvent.getContent() ? nameEvent.getContent()["name"] : "";

        const userId = client.getSafeUserId();
        this.state = {
            originalDisplayName: name,
            displayName: name,
            originalAvatarUrl: avatarUrl,
            avatarUrl: avatarUrl,
            avatarFile: null,
            originalTopic: topic,
            topic: topic,
            profileFieldsTouched: {},
            canSetName: room.currentState.maySendStateEvent(EventType.RoomName, userId),
            canSetTopic: room.currentState.maySendStateEvent(EventType.RoomTopic, userId),
            canSetAvatar: room.currentState.maySendStateEvent(EventType.RoomAvatar, userId),
        };
    }

    private uploadAvatar = (): void => {
        this.avatarUpload.current?.click();
    };

    private removeAvatar = (): void => {
        // clear file upload field so same file can be selected
        if (this.avatarUpload.current) this.avatarUpload.current.value = "";
        this.setState({
            avatarUrl: null,
            avatarFile: null,
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
            avatarUrl: this.state.originalAvatarUrl,
            avatarFile: null,
        });
    };

    private saveProfile = async (e: React.FormEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.isSaveEnabled()) return;
        this.setState({ profileFieldsTouched: {} });

        const client = MatrixClientPeg.get();
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
            newState.avatarUrl = mediaFromMxc(uri).getSquareThumbnailHttp(96);
            newState.originalAvatarUrl = newState.avatarUrl;
            newState.avatarFile = null;
        } else if (this.state.originalAvatarUrl !== this.state.avatarUrl) {
            await client.sendStateEvent(this.props.roomId, EventType.RoomAvatar, {}, "");
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

    private onAvatarChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
        if (!e.target.files || !e.target.files.length) {
            this.setState({
                avatarUrl: this.state.originalAvatarUrl,
                avatarFile: null,
                profileFieldsTouched: {
                    ...this.state.profileFieldsTouched,
                    avatar: false,
                },
            });
            return;
        }

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.setState({
                avatarUrl: String(ev.target?.result),
                avatarFile: file,
                profileFieldsTouched: {
                    ...this.state.profileFieldsTouched,
                    avatar: true,
                },
            });
        };
        reader.readAsDataURL(file);
    };

    public render(): React.ReactNode {
        let profileSettingsButtons;
        if (this.state.canSetName || this.state.canSetTopic || this.state.canSetAvatar) {
            profileSettingsButtons = (
                <div className="mx_ProfileSettings_buttons">
                    <AccessibleButton onClick={this.cancelProfileChanges} kind="link" disabled={!this.isSaveEnabled()}>
                        {_t("Cancel")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this.saveProfile} kind="primary" disabled={!this.isSaveEnabled()}>
                        {_t("Save")}
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <form onSubmit={this.saveProfile} autoComplete="off" noValidate={true} className="mx_ProfileSettings">
                <input
                    type="file"
                    ref={this.avatarUpload}
                    className="mx_ProfileSettings_avatarUpload"
                    onClick={chromeFileInputFix}
                    onChange={this.onAvatarChanged}
                    accept="image/*"
                />
                <div className="mx_ProfileSettings_profile">
                    <div className="mx_ProfileSettings_profile_controls">
                        <Field
                            label={_t("Room Name")}
                            type="text"
                            value={this.state.displayName}
                            autoComplete="off"
                            onChange={this.onDisplayNameChanged}
                            disabled={!this.state.canSetName}
                        />
                        <Field
                            className={classNames(
                                "mx_ProfileSettings_profile_controls_topic",
                                "mx_ProfileSettings_profile_controls_topic--room",
                            )}
                            id="profileTopic" // See: NewRoomIntro.tsx
                            label={_t("Room Topic")}
                            disabled={!this.state.canSetTopic}
                            type="text"
                            value={this.state.topic}
                            autoComplete="off"
                            onChange={this.onTopicChanged}
                            element="textarea"
                        />
                    </div>
                    <AvatarSetting
                        avatarUrl={this.state.avatarUrl ?? undefined}
                        avatarName={this.state.displayName || this.props.roomId}
                        avatarAltText={_t("Room avatar")}
                        uploadAvatar={this.state.canSetAvatar ? this.uploadAvatar : undefined}
                        removeAvatar={this.state.canSetAvatar ? this.removeAvatar : undefined}
                    />
                </div>
                {profileSettingsButtons}
            </form>
        );
    }
}
