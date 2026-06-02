/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Field, Label, Root } from "@vector-im/compound-web";
import { FilesIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { fileSize } from "../../../utils/FileUtils";

interface IProps {
    file: File;
    files?: File[];
    currentIndex: number;
    totalFiles: number;
    allowCaption?: boolean;
    onFinished: (uploadConfirmed: boolean, uploadAll?: boolean, caption?: string, files?: File[]) => void;
}

interface IState {
    objectUrls: string[];
    caption: string;
    files: File[];
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
            files: this.getInitialFiles(props),
            objectUrls: [],
        };
    }

    public componentDidMount(): void {
        this.setPreviewObjectUrls(this.state.files);

        if (this.shouldShowCaptionField()) {
            this.captionInput.current?.focus();
        }
    }

    public componentWillUnmount(): void {
        this.revokeObjectUrls(this.state.objectUrls);
    }

    private getInitialFiles(props: IProps): File[] {
        return props.files?.length ? [...props.files] : [props.file];
    }

    private revokeObjectUrls(objectUrls: string[]): void {
        for (const objectUrl of objectUrls) {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        }
    }

    private setPreviewObjectUrls(files: File[]): void {
        const objectUrls = files.map((file) => {
            if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
                // We do not filter the mimetype using getBlobSafeMimeType here as if the user is uploading the file
                // themselves they should be trusting it enough to open/load it, and it will be rendered into a hidden
                // canvas for thumbnail generation anyway
                return URL.createObjectURL(file);
            }
            return "";
        });

        this.setState({ objectUrls });
    }

    private onCancelClick = (): void => {
        this.props.onFinished(false);
    };

    private onUploadClick = (): void => {
        if (this.shouldShowCaptionField()) {
            const caption = this.state.caption.trim();
            if (this.isImageBatchUpload()) {
                this.props.onFinished(true, true, caption, [...this.state.files]);
            } else {
                this.props.onFinished(true, false, caption);
            }
        } else {
            this.props.onFinished(true, false);
        }
    };

    private onUploadAllClick = (): void => {
        this.props.onFinished(true, true);
    };

    private onCaptionChange = (ev: React.ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({ caption: ev.target.value });
    };

    private onRemoveFile = (index: number): void => {
        const files = this.state.files.filter((_, i) => i !== index);
        const objectUrls = this.state.objectUrls.filter((objectUrl, i) => {
            if (i === index && objectUrl) URL.revokeObjectURL(objectUrl);
            return i !== index;
        });

        this.setState({ files, objectUrls });
    };

    private onSubmit = (ev: React.FormEvent<HTMLFormElement>): void => {
        ev.preventDefault();
    };

    private shouldShowCaptionField(): boolean {
        return (
            !!this.props.allowCaption &&
            this.state.files.length > 0 &&
            (this.props.totalFiles === 1 || !!this.props.files?.length) &&
            this.state.files.every((file) => file.type.startsWith("image/"))
        );
    }

    private isImageBatchUpload(): boolean {
        return !!this.props.files?.length;
    }

    private isMultiImageUpload(): boolean {
        return this.isImageBatchUpload() && this.state.files.length > 1;
    }

    private renderSingleFilePreview(file: File, objectUrl: string | undefined): JSX.Element {
        const fileId = `mx-uploadconfirmdialog-${file.name}`;
        const mimeType = file.type;

        let preview: JSX.Element | undefined;
        let placeholder: JSX.Element | undefined;
        if (mimeType.startsWith("image/")) {
            preview = (
                <img className="mx_UploadConfirmDialog_imagePreview" src={objectUrl} aria-labelledby={fileId} />
            );
        } else if (mimeType.startsWith("video/")) {
            preview = (
                <video
                    className="mx_UploadConfirmDialog_imagePreview"
                    src={objectUrl}
                    playsInline
                    controls={false}
                />
            );
        } else {
            placeholder = <FilesIcon className="mx_UploadConfirmDialog_fileIcon" height="18px" width="18px" />;
        }

        return (
            <div className="mx_UploadConfirmDialog_previewInner">
                {preview && <div>{preview}</div>}
                <div id={fileId}>
                    {placeholder}
                    {file.name} ({fileSize(file.size)})
                </div>
            </div>
        );
    }

    private renderMultiImagePreview(): JSX.Element {
        return (
            <div className="mx_UploadConfirmDialog_thumbnailTray" role="list" aria-label={_t("upload_file|selected_images")}>
                {this.state.files.map((file, index) => {
                    const fileId = `mx-uploadconfirmdialog-${index}-${file.name}`;
                    return (
                        <div className="mx_UploadConfirmDialog_thumbnailItem" role="listitem" key={`${file.name}-${index}`}>
                            <img
                                className="mx_UploadConfirmDialog_thumbnailImage"
                                src={this.state.objectUrls[index]}
                                aria-labelledby={fileId}
                            />
                            <div id={fileId} className="mx_UploadConfirmDialog_thumbnailName">
                                {file.name}
                            </div>
                            {this.state.files.length > 1 && (
                                <button
                                    className="mx_UploadConfirmDialog_removeThumbnail"
                                    type="button"
                                    aria-label={_t("upload_file|remove_file_button", { fileName: file.name })}
                                    onClick={() => this.onRemoveFile(index)}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    public render(): React.ReactNode {
        let title: string;
        if (this.isImageBatchUpload()) {
            title = _t("upload_file|title");
        } else if (this.props.totalFiles > 1 && this.props.currentIndex !== undefined) {
            title = _t("upload_file|title_progress", {
                current: this.props.currentIndex + 1,
                total: this.props.totalFiles,
            });
        } else {
            title = _t("upload_file|title");
        }

        let uploadAllButton: JSX.Element | undefined;
        if (!this.isImageBatchUpload() && this.props.currentIndex + 1 < this.props.totalFiles) {
            uploadAllButton = (
                <button type="button" onClick={this.onUploadAllClick}>
                    {_t("upload_file|upload_all_button")}
                </button>
            );
        }

        const showCaptionField = this.shouldShowCaptionField();
        const captionField = showCaptionField && (
            <Field name="caption" className="mx_UploadConfirmDialog_caption">
                <Label htmlFor="mx_UploadConfirmDialog_captionInput">{_t("upload_file|caption_label")}</Label>
                <textarea
                    id="mx_UploadConfirmDialog_captionInput"
                    ref={this.captionInput}
                    autoFocus={true}
                    value={this.state.caption}
                    onChange={this.onCaptionChange}
                    placeholder={_t("upload_file|caption_placeholder")}
                    rows={3}
                />
            </Field>
        );

        return (
            <BaseDialog
                className="mx_UploadConfirmDialog"
                fixedWidth={false}
                onFinished={this.onCancelClick}
                title={title}
                contentId="mx_Dialog_content"
            >
                <Root id="mx_Dialog_content" onSubmit={this.onSubmit}>
                    <div className="mx_UploadConfirmDialog_previewOuter">
                        {this.isMultiImageUpload()
                            ? this.renderMultiImagePreview()
                            : this.renderSingleFilePreview(this.state.files[0], this.state.objectUrls[0])}
                    </div>
                    {captionField}

                    <DialogButtons
                        primaryButton={_t("action|upload")}
                        hasCancel={false}
                        onPrimaryButtonClick={this.onUploadClick}
                        focus={!showCaptionField}
                    >
                        {uploadAllButton}
                    </DialogButtons>
                </Root>
            </BaseDialog>
        );
    }
}
