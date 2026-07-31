import React from "react";

import { MatrixClientProps } from "../../../contexts/MatrixClientContext";
import { useSettingValue } from "../../../hooks/useSettings";
import EditorStateTransfer from "../../../utils/EditorStateTransfer";
import { EditWysiwygComposer } from "./wysiwyg_composer";
import {
    MessageComposerUrlPreviewViewModel,
    MessageComposerUrlPreviewViewModelProps,
} from "../../../viewmodels/composer/MessageComposerUrlPreviewViewModel";
import {
    MessageComposerUrlPreviewSnapshotEntry,
    MessageComposerUrlPreviewSnapshotEntryState,
    useCreateAutoDisposedViewModel,
    useViewModel,
} from "@element-hq/web-shared-components";
import PlatformPeg from "../../../PlatformPeg";
import { MessageComposerUrlPreviewWrapper } from "./MessageComposerUrlPreview";
import EditMessageComposer from "./EditMessageComposer";
import EditorModel from "../../../editor/model";
import { RoomMessageEventContent } from "../../../../@types/url-preview";
import { attachUrlPreviews } from "../../../utils/messages";
import { UrlPreviewFetcher } from "../../../utils/UrlPreviewFetcher";

interface IEditMessageComposerProps extends MatrixClientProps {
    showUrlPreview: boolean;
    editState: EditorStateTransfer;
    className?: string;
}

export function EditMessageComposerWrapper(props: IEditMessageComposerProps) {
    const urlPreviewBundleEnabled = useSettingValue("feature_msc4095_url_preview_bundle");
    const content = props.editState.getEvent().getContent<RoomMessageEventContent>();
    const bundleContent = content["com.beeper.linkpreviews"];
    const linksInMessage = MessageComposerUrlPreviewViewModel.linksIn(content.body);
    const linksInBundle = new Set(bundleContent?.map((entry) => entry.matched_url)) ?? new Set();

    const vm = useCreateAutoDisposedViewModel(() => {
        const urlPreviewFetcher = new UrlPreviewFetcher(props.mxClient, props.editState.getEvent().getTs(), true);
        let urlVmProps: MessageComposerUrlPreviewViewModelProps = {
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
                            status: "loaded",
                            preview: urlPreviewFetcher.previewFromBundle(entry),
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
        return new MessageComposerUrlPreviewViewModel(urlVmProps);
    });

    const { isModified: isUrlPreviewsModified } = useViewModel(vm);

    const onWysiwygChange = (content: string): void => {
        vm.updateWithText({ content, debounced: true });
    };

    const onChange = (model: EditorModel): void => {
        vm.updateWithText({ content: model.contentPlainText, debounced: true });
    };

    const attachBundles = (newContent: RoomMessageEventContent, messageHasLinks: boolean) => {
        attachUrlPreviews(vm.getSnapshot(), newContent, messageHasLinks);
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
