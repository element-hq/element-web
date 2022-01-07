/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from 'react';
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import AccessibleButton from "../../../elements/AccessibleButton";
import Notifier from "../../../../../Notifier";
import SettingsStore from '../../../../../settings/SettingsStore';
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { replaceableComponent } from "../../../../../utils/replaceableComponent";
import { RoomEchoChamber } from "../../../../../stores/local-echo/RoomEchoChamber";
import { EchoChamber } from '../../../../../stores/local-echo/EchoChamber';
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import StyledRadioGroup from "../../../elements/StyledRadioGroup";
import { RoomNotifState } from '../../../../../RoomNotifs';
import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import { UserTab } from "../../../dialogs/UserSettingsDialog";

interface IProps {
    roomId: string;
    closeSettingsFn(): void;
}

interface IState {
    currentSound: string;
    uploadedFile: File;
}

@replaceableComponent("views.settings.tabs.room.NotificationsSettingsTab")
export default class NotificationsSettingsTab extends React.Component<IProps, IState> {
    private readonly roomProps: RoomEchoChamber;
    private soundUpload = createRef<HTMLInputElement>();

    static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        this.roomProps = EchoChamber.forRoom(context.getRoom(this.props.roomId));

        this.state = {
            currentSound: "default",
            uploadedFile: null,
        };
    }

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    // eslint-disable-next-line @typescript-eslint/naming-convention, camelcase
    public UNSAFE_componentWillMount(): void {
        const soundData = Notifier.getSoundForRoom(this.props.roomId);
        if (!soundData) {
            return;
        }
        this.setState({ currentSound: soundData.name || soundData.url });
    }

    private triggerUploader = async (e: React.MouseEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        this.soundUpload.current.click();
    };

    private onSoundUploadChanged = (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
        if (!e.target.files || !e.target.files.length) {
            this.setState({
                uploadedFile: null,
            });
            return;
        }

        const file = e.target.files[0];
        this.setState({
            uploadedFile: file,
        });
    };

    private onClickSaveSound = async (e: React.MouseEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        try {
            await this.saveSound();
        } catch (ex) {
            logger.error(
                `Unable to save notification sound for ${this.props.roomId}`,
            );
            logger.error(ex);
        }
    };

    private async saveSound(): Promise<void> {
        if (!this.state.uploadedFile) {
            return;
        }

        let type = this.state.uploadedFile.type;
        if (type === "video/ogg") {
            // XXX: I've observed browsers allowing users to pick a audio/ogg files,
            // and then calling it a video/ogg. This is a lame hack, but man browsers
            // suck at detecting mimetypes.
            type = "audio/ogg";
        }

        const url = await MatrixClientPeg.get().uploadContent(
            this.state.uploadedFile, {
                type,
            },
        );

        await SettingsStore.setValue(
            "notificationSound",
            this.props.roomId,
            SettingLevel.ROOM_ACCOUNT,
            {
                name: this.state.uploadedFile.name,
                type: type,
                size: this.state.uploadedFile.size,
                url,
            },
        );

        this.setState({
            uploadedFile: null,
            currentSound: this.state.uploadedFile.name,
        });
    }

    private clearSound = (e: React.MouseEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        SettingsStore.setValue(
            "notificationSound",
            this.props.roomId,
            SettingLevel.ROOM_ACCOUNT,
            null,
        );

        this.setState({
            currentSound: "default",
        });
    };

    private onRoomNotificationChange = (value: RoomNotifState) => {
        this.roomProps.notificationVolume = value;
        this.forceUpdate();
    };

    private onOpenSettingsClick = () => {
        this.props.closeSettingsFn();
        defaultDispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Notifications,
        });
    };

    public render(): JSX.Element {
        let currentUploadedFile = null;
        if (this.state.uploadedFile) {
            currentUploadedFile = (
                <div>
                    <span>{ _t("Uploaded sound") }: <code>{ this.state.uploadedFile.name }</code></span>
                </div>
            );
        }

        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{ _t("Notifications") }</div>

                <div className="mx_SettingsTab_section mx_NotificationSettingsTab_notificationsSection">
                    <StyledRadioGroup
                        name="roomNotificationSetting"
                        definitions={[
                            {
                                value: RoomNotifState.AllMessages,
                                className: "mx_NotificationSettingsTab_defaultEntry",
                                label: <>
                                    { _t("Default") }
                                    <div className="mx_NotificationSettingsTab_microCopy">
                                        { _t("Get notifications as set up in your <a>settings</a>", {}, {
                                            a: sub => <AccessibleButton kind="link" onClick={this.onOpenSettingsClick}>
                                                { sub }
                                            </AccessibleButton>,
                                        }) }
                                    </div>
                                </>,
                            }, {
                                value: RoomNotifState.AllMessagesLoud,
                                className: "mx_NotificationSettingsTab_allMessagesEntry",
                                label: <>
                                    { _t("All messages") }
                                    <div className="mx_NotificationSettingsTab_microCopy">
                                        { _t("Get notified for every message") }
                                    </div>
                                </>,
                            }, {
                                value: RoomNotifState.MentionsOnly,
                                className: "mx_NotificationSettingsTab_mentionsKeywordsEntry",
                                label: <>
                                    { _t("@mentions & keywords") }
                                    <div className="mx_NotificationSettingsTab_microCopy">
                                        { _t("Get notified only with mentions and keywords " +
                                            "as set up in your <a>settings</a>", {}, {
                                            a: sub => <AccessibleButton kind="link" onClick={this.onOpenSettingsClick}>
                                                { sub }
                                            </AccessibleButton>,
                                        }) }
                                    </div>
                                </>,
                            }, {
                                value: RoomNotifState.Mute,
                                className: "mx_NotificationSettingsTab_noneEntry",
                                label: <>
                                    { _t("Off") }
                                    <div className="mx_NotificationSettingsTab_microCopy">
                                        { _t("You won't get any notifications") }
                                    </div>
                                </>,
                            },
                        ]}
                        onChange={this.onRoomNotificationChange}
                        value={this.roomProps.notificationVolume}
                    />
                </div>

                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>{ _t("Sounds") }</span>
                    <div>
                        <div className="mx_SettingsTab_subsectionText">
                            <span>{ _t("Notification sound") }: <code>{ this.state.currentSound }</code></span>
                        </div>
                        <AccessibleButton className="mx_NotificationSound_resetSound" disabled={this.state.currentSound == "default"} onClick={this.clearSound} kind="primary">
                            { _t("Reset") }
                        </AccessibleButton>
                    </div>
                    <div>
                        <h3>{ _t("Set a new custom sound") }</h3>
                        <div className="mx_SettingsFlag">
                            <form autoComplete="off" noValidate={true}>
                                <input ref={this.soundUpload} className="mx_NotificationSound_soundUpload" type="file" onChange={this.onSoundUploadChanged} accept="audio/*" />
                            </form>

                            { currentUploadedFile }
                        </div>

                        <AccessibleButton className="mx_NotificationSound_browse" onClick={this.triggerUploader} kind="primary">
                            { _t("Browse") }
                        </AccessibleButton>

                        <AccessibleButton className="mx_NotificationSound_save" disabled={this.state.uploadedFile == null} onClick={this.onClickSaveSound} kind="primary">
                            { _t("Save") }
                        </AccessibleButton>
                        <br />
                    </div>
                </div>
            </div>
        );
    }
}
