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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import {_t} from "../../../../../languageHandler";
import {MatrixClientPeg} from "../../../../../MatrixClientPeg";
import AccessibleButton from "../../../elements/AccessibleButton";
import Notifier from "../../../../../Notifier";
import SettingsStore from '../../../../../settings/SettingsStore';
import {SettingLevel} from "../../../../../settings/SettingLevel";

export default class NotificationsSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    _soundUpload = createRef();

    constructor() {
        super();

        this.state = {
            currentSound: "default",
            uploadedFile: null,
        };
    }

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount() { // eslint-disable-line camelcase
        const soundData = Notifier.getSoundForRoom(this.props.roomId);
        if (!soundData) {
            return;
        }
        this.setState({currentSound: soundData.name || soundData.url});
    }

    async _triggerUploader(e) {
        e.stopPropagation();
        e.preventDefault();

        this._soundUpload.current.click();
    }

    async _onSoundUploadChanged(e) {
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
    }

    async _onClickSaveSound(e) {
        e.stopPropagation();
        e.preventDefault();

        try {
            await this._saveSound();
        } catch (ex) {
            console.error(
                `Unable to save notification sound for ${this.props.roomId}`,
            );
            console.error(ex);
        }
    }

    async _saveSound() {
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

    _clearSound(e) {
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
    }

    render() {
        let currentUploadedFile = null;
        if (this.state.uploadedFile) {
            currentUploadedFile = (
                <div>
                    <span>{_t("Uploaded sound")}: <code>{this.state.uploadedFile.name}</code></span>
                </div>
            );
        }

        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Notifications")}</div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>{_t("Sounds")}</span>
                    <div>
                        <span>{_t("Notification sound")}: <code>{this.state.currentSound}</code></span><br />
                        <AccessibleButton className="mx_NotificationSound_resetSound" disabled={this.state.currentSound == "default"} onClick={this._clearSound.bind(this)} kind="primary">
                                {_t("Reset")}
                        </AccessibleButton>
                    </div>
                    <div>
                        <h3>{_t("Set a new custom sound")}</h3>
                        <form autoComplete="off" noValidate={true}>
                            <input ref={this._soundUpload} className="mx_NotificationSound_soundUpload" type="file" onChange={this._onSoundUploadChanged.bind(this)} accept="audio/*" />
                        </form>

                        {currentUploadedFile}

                        <AccessibleButton className="mx_NotificationSound_browse" onClick={this._triggerUploader.bind(this)} kind="primary">
                                {_t("Browse")}
                        </AccessibleButton>

                        <AccessibleButton className="mx_NotificationSound_save" disabled={this.state.uploadedFile == null} onClick={this._onClickSaveSound.bind(this)} kind="primary">
                                {_t("Save")}
                        </AccessibleButton>
                        <br />
                    </div>
                </div>
            </div>
        );
    }
}
