/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { useCallback, type JSX } from "react";

import { type MatrixClientProps } from "../../../contexts/MatrixClientContext";
import { useSettingValue } from "../../../hooks/useSettings";
import type EditorStateTransfer from "../../../utils/EditorStateTransfer";
import { EditWysiwygComposer } from "./wysiwyg_composer";
import { MessageComposerUrlPreviewViewModel } from "../../../viewmodels/composer/MessageComposerUrlPreviewViewModel";
import { useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";
import PlatformPeg from "../../../PlatformPeg";
import { MessageComposerUrlPreviewWrapper } from "./MessageComposerUrlPreview";
import EditMessageComposer from "./EditMessageComposer";
import type EditorModel from "../../../editor/model";
import { type RoomMessageEventContent } from "../../../../@types/url-preview";
import { attachUrlPreviews } from "../../../utils/messages";

interface IEditMessageComposerProps extends MatrixClientProps {
    showUrlPreview: boolean;
    editState: EditorStateTransfer;
    className?: string;
}

export function EditMessageComposerWrapper(props: IEditMessageComposerProps): JSX.Element {
    const urlPreviewBundleEnabled = useSettingValue("feature_msc4095_url_preview_bundle");

    const vm = useCreateAutoDisposedViewModel(() => {
        const content = props.editState.getEvent().getContent<RoomMessageEventContent>();

        return MessageComposerUrlPreviewViewModel.restoreFromMessage({
            client: props.mxClient,
            visible: props.showUrlPreview,
            showTooltips: PlatformPeg.get()?.needsUrlTooltips() ?? true,
            urlPreviewBundle: urlPreviewBundleEnabled,
            content,
        });
    });

    const { isModified: isUrlPreviewsModified } = useViewModel(vm);

    const onWysiwygChange = useCallback(
        (content: string): void => {
            vm.updateWithText({ content, debounced: true });
        },
        [vm],
    );

    const onChange = useCallback(
        (model: EditorModel): void => {
            vm.updateWithText({ content: model.contentPlainText, debounced: true });
        },
        [vm],
    );

    const attachBundles = useCallback(
        (newContent: RoomMessageEventContent): void => {
            attachUrlPreviews(vm.getSnapshot(), newContent);
        },
        [vm],
    );

    const isWysiwygComposerEnabled = useSettingValue("feature_wysiwyg_composer");
    const editor = isWysiwygComposerEnabled ? (
        <EditWysiwygComposer
            updateUrlPreviews={onWysiwygChange}
            attachBundles={attachBundles}
            isUrlPreviewsModified={isUrlPreviewsModified}
            editorStateTransfer={props.editState}
            className={props.className}
        />
    ) : (
        <EditMessageComposer
            updateUrlPreviews={onChange}
            attachBundles={attachBundles}
            isUrlPreviewsModified={isUrlPreviewsModified}
            editState={props.editState}
            className={props.className}
        />
    );

    return (
        <>
            <MessageComposerUrlPreviewWrapper urlPreviewVm={vm} />
            {editor}
        </>
    );
}
