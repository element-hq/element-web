/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { fileSize } from "../../../utils/FileUtils";
import {
    attachmentIcon,
    type MediaPreviewGroupEntry,
    type MediaPreviewGroupEntryContent,
    MediaPreviewGroupPreview,
} from "@element-hq/web-shared-components";
import { MediaPreviewGroupViewModel } from "../../../viewmodels/message-body/MediaPreviewGroupViewModel";

interface IProps {
    file: File;
    currentIndex: number;
    totalFiles: number;
    onFinished: (uploadConfirmed: boolean, uploadAll?: boolean) => void;
}

interface IState {
    objectUrl?: string;
    mediaPreviewVm?: MediaPreviewGroupViewModel;
}

const previewableFormats = ["video", "audio", "image"];
/**
 * previewable formats needs an object URL to be created for the preview
 */
function formatIsPreviewable(mimetype: string): boolean {
    return previewableFormats.includes(mimetype.split('/')[0]);
}

export default class UploadConfirmDialog extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        totalFiles: 1,
        currentIndex: 0,
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {};
    }

    public componentDidMount(): void {
        const mimeType = this.props.file.type;
        const previewContent = this.computePreviewContent(mimeType, this.state.objectUrl!);

        const preview: MediaPreviewGroupEntry = {
            id: this.props.file.name,
            header: this.props.file.name,
            body: fileSize(this.props.file.size),
            ...attachmentIcon(mimeType),
            ...previewContent,
        };

        const mediaPreviewVm = new MediaPreviewGroupViewModel({ entries: [preview] });

        if (formatIsPreviewable(this.props.file.type)) {
            this.setState({
                // We do not filter the mimetype using getBlobSafeMimeType here as if the user is uploading the file
                // themselves they should be trusting it enough to open/load it, and it will be rendered into a hidden
                // canvas for thumbnail generation anyway
                objectUrl: URL.createObjectURL(this.props.file),
                mediaPreviewVm,
            });
        } else {
            this.setState({ mediaPreviewVm });
        }
    }

    public componentWillUnmount(): void {
        if (this.state.objectUrl) URL.revokeObjectURL(this.state.objectUrl);
    }

    private onCancelClick = (): void => {
        this.props.onFinished(false);
    };

    private onUploadClick = (): void => {
        this.props.onFinished(true);
    };

    private onUploadAllClick = (): void => {
        this.props.onFinished(true, true);
    };

    private computePreviewContent(mimeType: string, objectUrl: string): MediaPreviewGroupEntryContent {
        switch (mimeType.split("/")[0]) {
            case "image":
                return {
                    style: "image",
                    imageSize: "tallbanner",
                    image: objectUrl,
                };
            case "video":
                return {
                    style: "video",
                    videoSize: "tallbanner",
                    video: objectUrl,
                };
            case "audio":
                return {
                    style: "audio",
                    audio: objectUrl,
                };
            default:
                return {
                    style: "text",
                };
        }
    }

    public render(): React.ReactNode {
        let title: string;
        if (this.props.totalFiles > 1 && this.props.currentIndex !== undefined) {
            title = _t("upload_file|title_progress", {
                current: this.props.currentIndex + 1,
                total: this.props.totalFiles,
            });
        } else {
            title = _t("upload_file|title");
        }


        let uploadAllButton: JSX.Element | undefined;
        if (this.props.currentIndex + 1 < this.props.totalFiles) {
            uploadAllButton = (
                <button onClick={this.onUploadAllClick} className="mx_LegacyDialogButton" type="button">
                    {_t("upload_file|upload_all_button")}
                </button>
            );
        }

        return (
            <BaseDialog
                className="mx_UploadConfirmDialog"
                fixedWidth={false}
                onFinished={this.onCancelClick}
                title={title}
                contentId="mx_Dialog_content"
            >
                <div id="mx_Dialog_content">
                    <div className="mx_UploadConfirmDialog_previewOuter">
                        <div className="mx_UploadConfirmDialog_previewInner">
                            {this.state.mediaPreviewVm && <MediaPreviewGroupPreview vm={this.state.mediaPreviewVm} />}
                        </div>
                    </div>
                </div>

                <DialogButtons
                    primaryButton={_t("action|upload")}
                    hasCancel={false}
                    onPrimaryButtonClick={this.onUploadClick}
                    focus={true}
                >
                    {uploadAllButton}
                </DialogButtons>
            </BaseDialog>
        );
    }
}
