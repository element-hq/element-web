/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";

import { type MatrixClientProps } from "../../../contexts/MatrixClientContext";
import { useSettingValue } from "../../../hooks/useSettings";
import type EditorStateTransfer from "../../../utils/EditorStateTransfer";
import { EditWysiwygComposer } from "./wysiwyg_composer";
import {
    MessageComposerUrlPreviewViewModel,
    type MessageComposerUrlPreviewViewModelProps,
} from "../../../viewmodels/composer/MessageComposerUrlPreviewViewModel";
import {
    type MessageComposerUrlPreviewSnapshotEntry,
    useCreateAutoDisposedViewModel,
    useViewModel,
} from "@element-hq/web-shared-components";
import PlatformPeg from "../../../PlatformPeg";
import { MessageComposerUrlPreviewWrapper } from "./MessageComposerUrlPreview";
import EditMessageComposer from "./EditMessageComposer";
import type EditorModel from "../../../editor/model";
import { type RoomMessageEventContent } from "../../../../@types/url-preview";
import { attachUrlPreviews } from "../../../utils/messages";
import { linksIn } from "../../../utils/UrlUtils";

interface IEditMessageComposerProps extends MatrixClientProps {
    showUrlPreview: boolean;
    editState: EditorStateTransfer;
    className?: string;
}

export function EditMessageComposerWrapper(props: IEditMessageComposerProps): JSX.Element {
    const urlPreviewBundleEnabled = useSettingValue("feature_msc4095_url_preview_bundle");
    const content = props.editState.getEvent().getContent<RoomMessageEventContent>();
    const bundleContent = content["com.beeper.linkpreviews"];
    const linksInMessage = linksIn(content.body);
    const linksInBundle = new Set(bundleContent?.map((entry) => entry.matched_url));

    const vm = useCreateAutoDisposedViewModel(() => {
        const urlVmProps: MessageComposerUrlPreviewViewModelProps = {
            client: props.mxClient,
            visible: props.showUrlPreview,
            showTooltips: PlatformPeg.get()?.needsUrlTooltips() ?? true,
            urlPreviewBundle: urlPreviewBundleEnabled,
            content: content.body,
        };

        if (urlPreviewBundleEnabled && bundleContent !== undefined) {
            urlVmProps.cachedEntries = new Map(
                bundleContent
                    .map((entry): [string, MessageComposerUrlPreviewSnapshotEntry] => [
                        entry.matched_url,
                        {
                            // previewFromBundle is async (it falls back to a server request when the
                            // bundle carries only matched_url), so the bundled entries start out
                            // loading and are resolved by resolveBundledPreviews below.
                            status: "loading",
                            include: true,
                            matched_url: entry.matched_url,
                        },
                    ])
                    .concat(
                        Array.from(linksInMessage)
                            .filter((link) => !linksInBundle.has(link))
                            .map((link): [string, MessageComposerUrlPreviewSnapshotEntry] => [
                                link,
                                { status: "failed", include: false, matched_url: link },
                            ]),
                    ),
            );
        }

        const urlVm = new MessageComposerUrlPreviewViewModel(urlVmProps);
        if (urlPreviewBundleEnabled && bundleContent !== undefined) {
            urlVm.resolveBundledPreviews(bundleContent, content.body);
        }
        return urlVm;
    });

    const { isModified: isUrlPreviewsModified } = useViewModel(vm);

    const onWysiwygChange = (content: string): void => {
        vm.updateWithText({ content, debounced: true });
    };

    const onChange = (model: EditorModel): void => {
        vm.updateWithText({ content: model.contentPlainText, debounced: true });
    };

    const attachBundles = (newContent: RoomMessageEventContent): void => {
        attachUrlPreviews(vm.getSnapshot(), newContent);
    };

    // function attachBundles(event: MatrixEv)

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
