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

import React from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { IEventRelation } from "matrix-js-sdk/src/matrix";
import { Optional } from "matrix-events-sdk";

import ContentMessages from "../../ContentMessages";
import dis from "../../dispatcher/dispatcher";
import { _t } from "../../languageHandler";
import { Action } from "../../dispatcher/actions";
import ProgressBar from "../views/elements/ProgressBar";
import AccessibleButton, { ButtonEvent } from "../views/elements/AccessibleButton";
import { RoomUpload } from "../../models/RoomUpload";
import { ActionPayload } from "../../dispatcher/payloads";
import { UploadPayload } from "../../dispatcher/payloads/UploadPayload";
import { fileSize } from "../../utils/FileUtils";

interface IProps {
    room: Room;
    relation?: IEventRelation;
}

interface IState {
    currentFile?: string;
    currentUpload?: RoomUpload;
    currentLoaded?: number;
    currentTotal?: number;
    countFiles: number;
}

function isUploadPayload(payload: ActionPayload): payload is UploadPayload {
    return [
        Action.UploadStarted,
        Action.UploadProgress,
        Action.UploadFailed,
        Action.UploadFinished,
        Action.UploadCanceled,
    ].includes(payload.action as Action);
}

export default class UploadBar extends React.PureComponent<IProps, IState> {
    private dispatcherRef: Optional<string>;
    private mounted = false;

    public constructor(props: IProps) {
        super(props);

        // Set initial state to any available upload in this room - we might be mounting
        // earlier than the first progress event, so should show something relevant.
        this.state = this.calculateState();
    }

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
        this.mounted = true;
    }

    public componentWillUnmount(): void {
        this.mounted = false;
        dis.unregister(this.dispatcherRef!);
    }

    private getUploadsInRoom(): RoomUpload[] {
        const uploads = ContentMessages.sharedInstance().getCurrentUploads(this.props.relation);
        return uploads.filter((u) => u.roomId === this.props.room.roomId);
    }

    private calculateState(): IState {
        const [currentUpload, ...otherUploads] = this.getUploadsInRoom();
        return {
            currentUpload,
            currentFile: currentUpload?.fileName,
            currentLoaded: currentUpload?.loaded,
            currentTotal: currentUpload?.total,
            countFiles: otherUploads.length + 1,
        };
    }

    private onAction = (payload: ActionPayload): void => {
        if (!this.mounted) return;
        if (isUploadPayload(payload)) {
            this.setState(this.calculateState());
        }
    };

    private onCancelClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ContentMessages.sharedInstance().cancelUpload(this.state.currentUpload!);
    };

    public render(): React.ReactNode {
        if (!this.state.currentFile) {
            return null;
        }

        // MUST use var name 'count' for pluralization to kick in
        const uploadText = _t("Uploading %(filename)s and %(count)s others", {
            filename: this.state.currentFile,
            count: this.state.countFiles - 1,
        });

        const uploadSize = fileSize(this.state.currentTotal!);
        return (
            <div className="mx_UploadBar">
                <div className="mx_UploadBar_filename">
                    {uploadText} ({uploadSize})
                </div>
                <AccessibleButton onClick={this.onCancelClick} className="mx_UploadBar_cancel" />
                <ProgressBar value={this.state.currentLoaded!} max={this.state.currentTotal!} />
            </div>
        );
    }
}
