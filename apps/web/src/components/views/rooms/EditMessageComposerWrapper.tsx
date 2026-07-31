import React from "react";

import { MatrixClientProps } from "../../../contexts/MatrixClientContext";
import { useSettingValue } from "../../../hooks/useSettings";
import EditorStateTransfer from "../../../utils/EditorStateTransfer";
import { EditWysiwygComposer } from "./wysiwyg_composer";
import { MessageComposerUrlPreviewViewModel } from "../../../viewmodels/composer/MessageComposerUrlPreviewViewModel";
import { useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";
import PlatformPeg from "../../../PlatformPeg";
import { MessageComposerUrlPreviewWrapper } from "./MessageComposerUrlPreview";
import EditMessageComposer from "./EditMessageComposer";
import EditorModel from "../../../editor/model";
import { RoomMessageEventContent } from "../../../../@types/url-preview";
import { attachUrlPreviews } from "../../../utils/messages";

interface IEditMessageComposerProps extends MatrixClientProps {
    showUrlPreview: boolean;
    editState: EditorStateTransfer;
    className?: string;
}

export function EditMessageComposerWrapper(props: IEditMessageComposerProps) {
    const urlPreviewBundle = useSettingValue("feature_msc4095_url_preview_bundle");

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new MessageComposerUrlPreviewViewModel({
                client: props.mxClient,
                visible: props.showUrlPreview,
                showTooltips: PlatformPeg.get()?.needsUrlTooltips() ?? true,
                urlPreviewBundle,
            }),
    );

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
            onChange={onWysiwygChange}
            attachBundles={attachBundles}
            editorStateTransfer={props.editState}
            className={props.className}
        />
    ) : (
        <EditMessageComposer
            onChange={onChange}
            attachBundles={attachBundles}
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
