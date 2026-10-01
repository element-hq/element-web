/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, type JSX } from "react";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { fileSize } from "../../../utils/FileUtils";
import {
    attachmentIcon,
    type MediaPreviewGroupEntry,
    type MediaPreviewGroupEntryContent,
    MediaPreviewGroupPreview,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";
import { MediaPreviewGroupViewModel } from "../../../viewmodels/message-body/MediaPreviewGroupViewModel";

interface IProps {
    file: File;
    /** Defaults to 0. */
    currentIndex?: number;
    /** Defaults to 1. */
    totalFiles?: number;
    onFinished: (uploadConfirmed: boolean, uploadAll?: boolean) => void;
}

const previewableFormats = ["video", "audio", "image"];
/**
 * previewable formats needs an object URL to be created for the preview
 */
function formatIsPreviewable(mimetype: string): boolean {
    return previewableFormats.includes(mimetype.split("/")[0]);
}

/**
 * objectUrl should only be undefined if mimetype is text
 */
function computePreviewContent(mimeType: string, fileName: string, objectUrl?: string): MediaPreviewGroupEntryContent {
    if (objectUrl === undefined)
        return {
            type: "text",
        };

    switch (mimeType.split("/")[0]) {
        case "image":
            return {
                type: "image",
                imageSize: "tallbanner",
                image: objectUrl,
                imageAlt: fileName,
            };
        case "video":
            return {
                type: "video",
                videoSize: "tallbanner",
                video: objectUrl,
            };
        case "audio":
            return {
                type: "audio",
                audio: objectUrl,
            };
        default:
            return {
                type: "text",
            };
    }
}

/**
 * Owns the object URL used for the preview so that its lifetime is tied to the lifetime of the
 * view-model: it is revoked when the view-model is disposed, i.e. when the dialog unmounts.
 */
class UploadPreviewViewModel extends MediaPreviewGroupViewModel {
    public constructor(file: File) {
        const mimeType = file.type;
        const objectUrl = formatIsPreviewable(mimeType) ? URL.createObjectURL(file) : undefined;

        const preview: MediaPreviewGroupEntry = {
            id: file.name,
            header: file.name,
            body: fileSize(file.size),
            ...attachmentIcon(mimeType),
            ...computePreviewContent(mimeType, file.name, objectUrl),
        };

        super({ entries: [preview] });

        if (objectUrl !== undefined) this.disposables.track(() => URL.revokeObjectURL(objectUrl));
    }
}

export default function UploadConfirmDialog({
    file,
    currentIndex = 0,
    totalFiles = 1,
    onFinished,
}: IProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new UploadPreviewViewModel(file));

    let title: string;
    if (totalFiles > 1 && currentIndex !== undefined) {
        title = _t("upload_file|title_progress", {
            current: currentIndex + 1,
            total: totalFiles,
        });
    } else {
        title = _t("upload_file|title");
    }

    const onCancelClick = useCallback((): void => {
        onFinished(false);
    }, [onFinished]);

    const onUploadClick = useCallback((): void => {
        onFinished(true);
    }, [onFinished]);

    const onUploadAllClick = useCallback((): void => {
        onFinished(true, true);
    }, [onFinished]);

    let uploadAllButton: JSX.Element | undefined;
    if (currentIndex + 1 < totalFiles) {
        uploadAllButton = (
            <button onClick={onUploadAllClick} className="mx_LegacyDialogButton" type="button">
                {_t("upload_file|upload_all_button")}
            </button>
        );
    }

    return (
        <BaseDialog
            className="mx_UploadConfirmDialog"
            fixedWidth={false}
            onFinished={onCancelClick}
            title={title}
            contentId="mx_Dialog_content"
        >
            <div id="mx_Dialog_content">
                <div className="mx_UploadConfirmDialog_previewOuter">
                    <div className="mx_UploadConfirmDialog_previewInner">
                        <MediaPreviewGroupPreview vm={vm} />
                    </div>
                </div>
            </div>

            <DialogButtons
                primaryButton={_t("action|upload")}
                hasCancel={false}
                onPrimaryButtonClick={onUploadClick}
                focus={true}
            >
                {uploadAllButton}
            </DialogButtons>
        </BaseDialog>
    );
}
