/*
Copyright 2015, 2016, 2019, 2021 The Matrix.org Foundation C.I.C.

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
import { Room } from "matrix-js-sdk/src/models/room";
import ContentMessages from '../../ContentMessages';
import dis from "../../dispatcher/dispatcher";
import filesize from "filesize";
import { _t } from '../../languageHandler';
import { ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions";
import ProgressBar from "../views/elements/ProgressBar";
import AccessibleButton from "../views/elements/AccessibleButton";
import { IUpload } from "../../models/IUpload";
import {replaceableComponent} from "../../utils/replaceableComponent";

interface IProps {
    room: Room;
}

interface IState {
    currentUpload?: IUpload;
    uploadsHere: IUpload[];
}

@replaceableComponent("structures.UploadBar")
export default class UploadBar extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private mounted: boolean;

    constructor(props) {
        super(props);

        // Set initial state to any available upload in this room - we might be mounting
        // earlier than the first progress event, so should show something relevant.
        const uploadsHere = this.getUploadsInRoom();
        this.state = {currentUpload: uploadsHere[0], uploadsHere};
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        this.mounted = true;
    }

    componentWillUnmount() {
        this.mounted = false;
        dis.unregister(this.dispatcherRef);
    }

    private getUploadsInRoom(): IUpload[] {
        const uploads = ContentMessages.sharedInstance().getCurrentUploads();
        return uploads.filter(u => u.roomId === this.props.room.roomId);
    }

    private onAction = (payload: ActionPayload) => {
        switch (payload.action) {
            case Action.UploadStarted:
            case Action.UploadProgress:
            case Action.UploadFinished:
            case Action.UploadCanceled:
            case Action.UploadFailed: {
                if (!this.mounted) return;
                const uploadsHere = this.getUploadsInRoom();
                this.setState({currentUpload: uploadsHere[0], uploadsHere});
                break;
            }
        }
    };

    private onCancelClick = (ev) => {
        ev.preventDefault();
        ContentMessages.sharedInstance().cancelUpload(this.state.currentUpload.promise);
    };

    render() {
        if (!this.state.currentUpload) {
            return null;
        }

        // MUST use var name 'count' for pluralization to kick in
        const uploadText = _t(
            "Uploading %(filename)s and %(count)s others", {
                filename: this.state.currentUpload.fileName,
                count: this.state.uploadsHere.length - 1,
            },
        );

        const uploadSize = filesize(this.state.currentUpload.total);
        return (
            <div className="mx_UploadBar">
                <div className="mx_UploadBar_filename">{uploadText} ({uploadSize})</div>
                <AccessibleButton onClick={this.onCancelClick} className='mx_UploadBar_cancel' />
                <ProgressBar value={this.state.currentUpload.loaded} max={this.state.currentUpload.total} />
            </div>
        );
    }
}
