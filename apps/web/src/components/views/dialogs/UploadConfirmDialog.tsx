/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { FilesIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { fileSize } from "../../../utils/FileUtils";

interface IProps {
    file: File;
    currentIndex: number;
    totalFiles: number;
    /** Keep caption collection opt-in for callers that do not expose it yet. */
    allowCaption?: boolean;
    onFinished: (uploadConfirmed: boolean, uploadAll?: boolean, caption?: string) => void;
}

interface IState {
    objectUrl?: string;
    caption: string;
}

export default class UploadConfirmDialog extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        totalFiles: 1,
        currentIndex: 0,
        allowCaption: false,
    };

    private readonly captionInput = React.createRef<HTMLTextAreaElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            caption: "",
        };
    }

    public componentDidMount(): void {
        if (this.props.file.type.startsWith("image/") || this.props.file.type.startsWith("video/")) {
            this.setState({
                // We do not filter the mimetype using getBlobSafeMimeType here as if the user is uploading the file
                // themselves they should be trusting it enough to open/load it, and it will be rendered into a hidden
                // canvas for thumbnail generation anyway
                objectUrl: URL.createObjectURL(this.props.file),
            });
        }

        if (this.shouldShowCaptionField()) {
            this.captionInput.current?.focus();
        }
    }

    public componentWillUnmount(): void {
        if (this.state.objectUrl) URL.revokeObjectURL(this.state.objectUrl);
    }

    private onCancelClick = (): void => {
        this.props.onFinished(false);
    };

    private onUploadClick = (): void => {
        if (this.shouldShowCaptionField()) {
            this.props.onFinished(true, false, this.state.caption.trim());
            return;
        }

        this.props.onFinished(true);
    };

    private onUploadAllClick = (): void => {
        if (this.shouldShowCaptionField()) {
            const caption = this.state.caption.trim();
            this.props.onFinished(true, true, caption || undefined);
            return;
        }

        this.props.onFinished(true, true);
    };

    private onCaptionChange = (ev: React.ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({ caption: ev.target.value });
    };

    private onCaptionKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        // Plain Enter inserts a newline in the textarea, so Ctrl/Cmd+Enter is the submit shortcut.
        if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
            ev.preventDefault();
            this.onUploadClick();
        }
    };

    private shouldShowCaptionField(): boolean {
        return this.props.allowCaption === true && this.props.file.type.startsWith("image/");
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

        const fileId = `mx-uploadconfirmdialog-${this.props.file.name}`;
        const mimeType = this.props.file.type;

        let preview: JSX.Element | undefined;
        let placeholder: JSX.Element | undefined;
        if (mimeType.startsWith("image/")) {
            preview = (
                <img
                    className="mx_UploadConfirmDialog_imagePreview"
                    src={this.state.objectUrl}
                    aria-labelledby={fileId}
                />
            );
        } else if (mimeType.startsWith("video/")) {
            preview = (
                <video
                    className="mx_UploadConfirmDialog_imagePreview"
                    src={this.state.objectUrl}
                    playsInline
                    controls={false}
                />
            );
        } else {
            placeholder = <FilesIcon className="mx_UploadConfirmDialog_fileIcon" height="18px" width="18px" />;
        }

        let uploadAllButton: JSX.Element | undefined;
        if (this.props.currentIndex + 1 < this.props.totalFiles) {
            uploadAllButton = (
                <button onClick={this.onUploadAllClick} type="button">
                    {_t("upload_file|upload_all_button")}
                </button>
            );
        }

        const showCaptionField = this.shouldShowCaptionField();
        const captionField = showCaptionField ? (
            <div className="mx_UploadConfirmDialog_caption">
                <label htmlFor="mx_UploadConfirmDialog_captionInput">{_t("upload_file|caption_label")}</label>
                <textarea
                    id="mx_UploadConfirmDialog_captionInput"
                    name="caption"
                    ref={this.captionInput}
                    autoFocus
                    value={this.state.caption}
                    onChange={this.onCaptionChange}
                    onKeyDown={this.onCaptionKeyDown}
                    placeholder={_t("upload_file|caption_placeholder")}
                    rows={3}
                />
            </div>
        ) : null;

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
                            {preview && <div>{preview}</div>}
                            <div id={fileId}>
                                {placeholder}
                                {this.props.file.name} ({fileSize(this.props.file.size)})
                            </div>
                        </div>
                    </div>
                    {captionField}
                </div>

                <DialogButtons
                    primaryButton={_t("action|upload")}
                    hasCancel={false}
                    onPrimaryButtonClick={this.onUploadClick}
                    focus={!showCaptionField}
                >
                    {uploadAllButton}
                </DialogButtons>
            </BaseDialog>
        );
    }
}
