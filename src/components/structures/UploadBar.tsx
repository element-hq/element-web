/*
Copyright 2024 New Vector Ltd.
Copyright 2015, 2016 , 2019, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Room, type IEventRelation } from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";

import ContentMessages from "../../ContentMessages";
import dis from "../../dispatcher/dispatcher";
import { _t } from "../../languageHandler";
import { Action } from "../../dispatcher/actions";
import ProgressBar from "../views/elements/ProgressBar";
import AccessibleButton, { type ButtonEvent } from "../views/elements/AccessibleButton";
import { type RoomUpload } from "../../models/RoomUpload";
import { type ActionPayload } from "../../dispatcher/payloads";
import { type UploadPayload } from "../../dispatcher/payloads/UploadPayload";
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
    private unmounted = false;

    public constructor(props: IProps) {
        super(props);

        // Set initial state to any available upload in this room - we might be mounting
        // earlier than the first progress event, so should show something relevant.
        this.state = this.calculateState();
    }

    public componentDidMount(): void {
        this.unmounted = false;
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
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
        if (this.unmounted) return;
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

        let uploadText: string;
        if (this.state.countFiles > 1) {
            // MUST use var name 'count' for pluralization to kick in
            uploadText = _t("room|upload|uploading_multiple_file", {
                filename: this.state.currentFile,
                count: this.state.countFiles - 1,
            });
        } else {
            uploadText = _t("room|upload|uploading_single_file", {
                filename: this.state.currentFile,
            });
        }

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
