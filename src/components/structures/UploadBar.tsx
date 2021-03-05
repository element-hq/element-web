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
import ContentMessages from '../../ContentMessages';
import dis from "../../dispatcher/dispatcher";
import filesize from "filesize";
import { _t } from '../../languageHandler';
import {Room} from "matrix-js-sdk/src/models/room";
import {ActionPayload} from "../../dispatcher/payloads";
import {Action} from "../../dispatcher/actions";
import ProgressBar from "../views/elements/ProgressBar";

interface IProps {
    room: Room;
}

interface IState {
}

export default class UploadBar extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private mounted: boolean;

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        this.mounted = true;
    }

    componentWillUnmount() {
        this.mounted = false;
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload) => {
        switch (payload.action) {
            case Action.UploadProgress:
            case Action.UploadFinished:
            case Action.UploadCanceled:
            case Action.UploadFailed:
                if (this.mounted) this.forceUpdate();
                break;
        }
    };

    render() {
        const uploads = ContentMessages.sharedInstance().getCurrentUploads();

        // for testing UI... - also fix up the ContentMessages.getCurrentUploads().length
        // check in RoomView
        //
        // uploads = [{
        //     roomId: this.props.room.roomId,
        //     loaded: 123493,
        //     total: 347534,
        //     fileName: "testing_fooble.jpg",
        // }];

        const uploadsHere = uploads.filter(u => u.roomId === this.props.room.roomId);
        if (uploadsHere.length == 0) {
            return null;
        }

        const currentUpload = uploadsHere[0];
        const uploadSize = filesize(currentUpload.total);

        // MUST use var name 'count' for pluralization to kick in
        const uploadText = _t(
            "Uploading %(filename)s and %(count)s others", {
                filename: currentUpload.fileName,
                count: uploadsHere.length - 1,
            },
        );

        return (
            <div className="mx_UploadBar">
                <img className="mx_UploadBar_uploadCancel mx_filterFlipColor" src={require("../../../res/img/cancel.svg")} width="18" height="18"
                    onClick={function() { ContentMessages.sharedInstance().cancelUpload(currentUpload.promise); }}
                />
                <div className="mx_UploadBar_uploadFilename">{uploadText} ({uploadSize})</div>
                <ProgressBar value={currentUpload.loaded} max={currentUpload.total} />
            </div>
        );
    }
}
