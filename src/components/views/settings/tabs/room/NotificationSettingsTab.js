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

import React from 'react';
import PropTypes from 'prop-types';
import {_t} from "../../../../../languageHandler";
import MatrixClientPeg from "../../../../../MatrixClientPeg";
import AccessibleButton from "../../../elements/AccessibleButton";
import Notifier from "../../../../../Notifier";

export default class NotificationsSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
        closeSettingsFn: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        this.state = {
            currentSound: "default",
            uploadedFile: null,
        };
    }

    componentWillMount() {
        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        Notifier.getSoundForRoom(room).then((soundData) => {
            if (!soundData) {
                return;
            }
            this.setState({currentSound: soundData.name || soundData.url});
        });
    }

    _onSoundUploadChanged(e) {
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

    async _saveSound(e) {
        e.stopPropagation();
        e.preventDefault();
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

        const room = MatrixClientPeg.get().getRoom(this.props.roomId);

        await Notifier.setRoomSound(room, {
            name: this.state.uploadedFile.name,
            type: type,
            size: this.state.uploadedFile.size,
            url,
        });

        this.setState({
            uploadedFile: null,
            uploadedFileUrl: null,
            currentSound: this.state.uploadedFile.name,
        });
    }

    _clearSound(e) {
        e.stopPropagation();
        e.preventDefault();
        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        Notifier.clearRoomSound(room);

        this.setState({
            currentSound: "default",
        });
    }

    render() {
        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Notifications")}</div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>{_t("Sounds")}</span>
                    <div>
                        <span>{_t("Notification sound")}: <code>{this.state.currentSound}</code></span>
                    </div>
                    <div>
                        <h3>{_t("Set a new custom sound")}</h3>
                        <form onSubmit={this._saveSound.bind(this)} autoComplete={false} noValidate={true}>
                            <input type="file" onChange={this._onSoundUploadChanged.bind(this)} accept="audio/*" />
                            <AccessibleButton onClick={this._saveSound.bind(this)} kind="primary" disabled={!this.state.uploadedFile}>
                                {_t("Save")}
                            </AccessibleButton>
                        </form>
                        <AccessibleButton onClick={this._clearSound.bind(this)} kind="primary">
                                {_t("Reset to default sound")}
                        </AccessibleButton>
                    </div>
                </div>
            </div>
        );
    }
}
