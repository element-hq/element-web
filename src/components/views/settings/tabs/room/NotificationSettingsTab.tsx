/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../../../elements/AccessibleButton";
import Notifier from "../../../../../Notifier";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { type RoomEchoChamber } from "../../../../../stores/local-echo/RoomEchoChamber";
import { EchoChamber } from "../../../../../stores/local-echo/EchoChamber";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import StyledRadioGroup from "../../../elements/StyledRadioGroup";
import { RoomNotifState } from "../../../../../RoomNotifs";
import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import { UserTab } from "../../../dialogs/UserTab";
import { chromeFileInputFix } from "../../../../../utils/BrowserWorkarounds";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection } from "../../shared/SettingsSubsection";

interface IProps {
    roomId: string;
    closeSettingsFn(): void;
}

interface IState {
    currentSound: string;
    uploadedFile: File | null;
}

export default class NotificationsSettingsTab extends React.Component<IProps, IState> {
    private readonly roomProps: RoomEchoChamber;
    private soundUpload = createRef<HTMLInputElement>();

    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        this.roomProps = EchoChamber.forRoom(context.getRoom(this.props.roomId)!);

        let currentSound = "default";
        const soundData = Notifier.getSoundForRoom(this.props.roomId);
        if (soundData) {
            currentSound = soundData.name || soundData.url;
        }

        this.state = {
            currentSound,
            uploadedFile: null,
        };
    }

    private triggerUploader = async (e: ButtonEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        this.soundUpload.current?.click();
    };

    private onSoundUploadChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
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

    private onClickSaveSound = async (e: ButtonEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        try {
            await this.saveSound();
        } catch (ex) {
            logger.error(`Unable to save notification sound for ${this.props.roomId}`);
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

        const { content_uri: url } = await this.context.uploadContent(this.state.uploadedFile, {
            type,
        });

        await SettingsStore.setValue("notificationSound", this.props.roomId, SettingLevel.ROOM_ACCOUNT, {
            name: this.state.uploadedFile.name,
            type: type,
            size: this.state.uploadedFile.size,
            url,
        });

        this.setState({
            uploadedFile: null,
            currentSound: this.state.uploadedFile.name,
        });
    }

    private clearSound = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        SettingsStore.setValue("notificationSound", this.props.roomId, SettingLevel.ROOM_ACCOUNT, null);

        this.setState({
            currentSound: "default",
        });
    };

    private onRoomNotificationChange = (value: RoomNotifState): void => {
        this.roomProps.notificationVolume = value;
        this.forceUpdate();
    };

    private onOpenSettingsClick = (event: ButtonEvent): void => {
        // avoid selecting the radio button
        event.preventDefault();
        this.props.closeSettingsFn();
        defaultDispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Notifications,
        });
    };

    public render(): React.ReactNode {
        let currentUploadedFile: JSX.Element | undefined;
        if (this.state.uploadedFile) {
            currentUploadedFile = (
                <div>
                    <span>
                        {_t("room_settings|notifications|uploaded_sound")}: <code>{this.state.uploadedFile.name}</code>
                    </span>
                </div>
            );
        }

        return (
            <SettingsTab>
                <SettingsSection heading={_t("notifications|enable_prompt_toast_title")}>
                    <div className="mx_NotificationSettingsTab_notificationsSection">
                        <StyledRadioGroup
                            name="roomNotificationSetting"
                            definitions={[
                                {
                                    value: RoomNotifState.AllMessages,
                                    className: "mx_NotificationSettingsTab_defaultEntry",
                                    label: (
                                        <>
                                            {_t("notifications|default")}
                                            <div className="mx_NotificationSettingsTab_microCopy">
                                                {_t(
                                                    "room_settings|notifications|settings_link",
                                                    {},
                                                    {
                                                        a: (sub) => (
                                                            <AccessibleButton
                                                                kind="link_inline"
                                                                onClick={this.onOpenSettingsClick}
                                                            >
                                                                {sub}
                                                            </AccessibleButton>
                                                        ),
                                                    },
                                                )}
                                            </div>
                                        </>
                                    ),
                                },
                                {
                                    value: RoomNotifState.AllMessagesLoud,
                                    className: "mx_NotificationSettingsTab_allMessagesEntry",
                                    label: (
                                        <>
                                            {_t("notifications|all_messages")}
                                            <div className="mx_NotificationSettingsTab_microCopy">
                                                {_t("notifications|all_messages_description")}
                                            </div>
                                        </>
                                    ),
                                },
                                {
                                    value: RoomNotifState.MentionsOnly,
                                    className: "mx_NotificationSettingsTab_mentionsKeywordsEntry",
                                    label: (
                                        <>
                                            {_t("notifications|mentions_and_keywords")}
                                            <div className="mx_NotificationSettingsTab_microCopy">
                                                {_t(
                                                    "notifications|mentions_and_keywords_description",
                                                    {},
                                                    {
                                                        a: (sub) => (
                                                            <AccessibleButton
                                                                kind="link_inline"
                                                                onClick={this.onOpenSettingsClick}
                                                            >
                                                                {sub}
                                                            </AccessibleButton>
                                                        ),
                                                    },
                                                )}
                                            </div>
                                        </>
                                    ),
                                },
                                {
                                    value: RoomNotifState.Mute,
                                    className: "mx_NotificationSettingsTab_noneEntry",
                                    label: (
                                        <>
                                            {_t("common|off")}
                                            <div className="mx_NotificationSettingsTab_microCopy">
                                                {_t("notifications|mute_description")}
                                            </div>
                                        </>
                                    ),
                                },
                            ]}
                            onChange={this.onRoomNotificationChange}
                            value={this.roomProps.notificationVolume}
                        />
                    </div>

                    <SettingsSubsection heading={_t("room_settings|notifications|sounds_section")}>
                        <div>
                            <div className="mx_SettingsTab_subsectionText">
                                <span>
                                    {_t("room_settings|notifications|notification_sound")}:{" "}
                                    <code>{this.state.currentSound}</code>
                                </span>
                            </div>
                            <AccessibleButton
                                className="mx_NotificationSound_resetSound"
                                disabled={this.state.currentSound == "default"}
                                onClick={this.clearSound}
                                kind="primary"
                            >
                                {_t("action|reset")}
                            </AccessibleButton>
                        </div>
                        <div>
                            <h4 className="mx_Heading_h4">{_t("room_settings|notifications|custom_sound_prompt")}</h4>
                            <div className="mx_SettingsFlag">
                                <form autoComplete="off" noValidate={true}>
                                    <input
                                        ref={this.soundUpload}
                                        className="mx_NotificationSound_soundUpload"
                                        type="file"
                                        onClick={chromeFileInputFix}
                                        onChange={this.onSoundUploadChanged}
                                        accept="audio/*"
                                        aria-label={_t("room_settings|notifications|upload_sound_label")}
                                    />
                                </form>

                                {currentUploadedFile}
                            </div>

                            <AccessibleButton
                                className="mx_NotificationSound_browse"
                                onClick={this.triggerUploader}
                                kind="primary"
                            >
                                {_t("room_settings|notifications|browse_button")}
                            </AccessibleButton>

                            <AccessibleButton
                                className="mx_NotificationSound_save"
                                disabled={this.state.uploadedFile == null}
                                onClick={this.onClickSaveSound}
                                kind="primary"
                            >
                                {_t("action|save")}
                            </AccessibleButton>
                            <br />
                        </div>
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}
