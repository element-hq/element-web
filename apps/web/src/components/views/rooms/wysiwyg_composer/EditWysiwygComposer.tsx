/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type JSX,
    type MutableRefObject,
    type RefObject,
    useEffect,
    useMemo,
    useRef,
    type ReactNode,
} from "react";
import { useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";
import classNames from "classnames";
import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";

import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import { WysiwygComposer } from "./components/WysiwygComposer";
import { EditionButtons } from "./components/EditionButtons";
import { useWysiwygEditActionHandler } from "./hooks/useWysiwygEditActionHandler";
import { useEditing } from "./hooks/useEditing";
import { useInitialContent } from "./hooks/useInitialContent";
import { ComposerContext, getDefaultContextValue } from "./ComposerContext";
import { type ComposerFunctions } from "./types";
import ContentMessages from "../../../../ContentMessages";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { getEditableMediaItems, getMessageMediaItems } from "../../../../utils/gallery";
import { useSettingValue } from "../../../../hooks/useSettings";
import { MessageAttachments } from "../MessageAttachments";
import { type EditorActions } from "../EditorActions";
import { GalleryComposerViewModel } from "../../../../viewmodels/composer/GalleryComposerViewModel";

interface ContentProps {
    disabled?: boolean;
    composerFunctions: ComposerFunctions;
    ref?: RefObject<HTMLElement | null>;
}

const Content = function Content({ disabled = false, composerFunctions, ref }: ContentProps): ReactNode {
    useWysiwygEditActionHandler(disabled, ref, composerFunctions);
    return null;
};

interface EditWysiwygComposerProps {
    disabled?: boolean;
    updateUrlPreviews?: (content: string) => void;
    /** Attaches URL preview bundles (MSC4095) to the new content before it is sent. */
    attachBundles?: (content: RoomMessageEventContent) => Promise<boolean>;
    /**
     * Whether the user has modified the preview list (e.g. removed a preview). When true the edit is
     * treated as modified even if the text is unchanged: the Save button is enabled and the edit is sent.
     */
    isUrlPreviewsModified?: boolean;
    editorStateTransfer: EditorStateTransfer;
    className?: string;
    /**
     * Renders the editor inside the message composer at the bottom of the room, which shows the
     * attachments and the buttons to save and cancel in place of the editor's own.
     */
    inComposer?: boolean;
    /**
     * Reports the attachments of the message being edited, or undefined once the editor is gone,
     * for the message composer to show them.
     */
    onAttachmentsChange?: (attachments?: GalleryComposerViewModel) => void;
    /**
     * Filled with the actions of the editor, for the message composer's buttons to call.
     */
    actionsRef?: MutableRefObject<EditorActions | null>;
}

// Default needed for React.lazy
export default function EditWysiwygComposer({
    editorStateTransfer,
    className,
    attachBundles,
    updateUrlPreviews,
    isUrlPreviewsModified,
    inComposer,
    onAttachmentsChange,
    actionsRef,
    ...props
}: EditWysiwygComposerProps): JSX.Element {
    const defaultContextValue = useMemo(() => getDefaultContextValue({ editorStateTransfer }), [editorStateTransfer]);
    const initialContent = useInitialContent(editorStateTransfer);
    const isReady = !editorStateTransfer || initialContent !== undefined;

    // The images and videos of the message being edited, for the user to remove items and add
    // more. Also present for a text message, which images and videos can be added to, when sending
    // them is enabled.
    const mxClient = useMatrixClientContext();
    const isGalleryEnabled = useSettingValue("feature_gallery_messages");
    const content = editorStateTransfer.getEvent().getContent();
    const hasMedia = getMessageMediaItems(content) !== undefined;
    const mediaItems = useMemo(
        () => (isGalleryEnabled ? getEditableMediaItems(content) : getMessageMediaItems(content)),
        // The editor is remounted for each message, and keeps the attachments it started with.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [editorStateTransfer],
    );
    const attachmentsVm = useCreateAutoDisposedViewModel(
        () => new GalleryComposerViewModel({ items: mediaItems ?? [] }),
    );
    const attachments = mediaItems ? attachmentsVm : undefined;
    useEffect(() => {
        if (!attachments) return;
        onAttachmentsChange?.(attachments);
        void ContentMessages.sharedInstance()
            .fetchUploadLimit(mxClient)
            .then((limit) => attachments.setMaxFileSize(limit ?? undefined));
        return () => onAttachmentsChange?.(undefined);
    }, [attachments, mxClient, onAttachmentsChange]);

    const { editMessage, endEditing, onChange, isSaveDisabled } = useEditing(
        editorStateTransfer,
        initialContent,
        attachBundles,
        updateUrlPreviews,
        isUrlPreviewsModified,
        attachments,
        hasMedia,
    );

    // The message composer's buttons call whichever save and cancel are current.
    const actions = useRef<EditorActions>({ save: () => {}, cancel: () => {} });
    actions.current.save = (): void => void editMessage();
    actions.current.cancel = endEditing;
    useEffect(() => {
        if (!actionsRef) return;
        const current = actions.current;
        actionsRef.current = current;
        return () => {
            if (actionsRef.current === current) actionsRef.current = null;
        };
    }, [actionsRef]);

    if (!isReady) {
        return <></>;
    }

    return (
        <ComposerContext.Provider value={defaultContextValue}>
            <WysiwygComposer
                className={classNames(
                    "mx_EditWysiwygComposer",
                    { mx_EditWysiwygComposer_inComposer: inComposer },
                    className,
                )}
                initialContent={initialContent}
                onChange={onChange}
                onSend={editMessage}
                {...props}
            >
                {(ref, composerFunctions) => (
                    <>
                        <Content disabled={props.disabled} ref={ref} composerFunctions={composerFunctions} />
                        {/* In the message composer, the composer shows the attachments and the buttons instead. */}
                        {attachments && !inComposer && (
                            <MessageAttachments
                                vm={attachments}
                                alwaysShow={hasMedia}
                                className="mx_EditWysiwygComposer_attachments"
                            />
                        )}
                        {!inComposer && (
                            <EditionButtons
                                onCancelClick={endEditing}
                                onSaveClick={editMessage}
                                isSaveDisabled={isSaveDisabled}
                            />
                        )}
                    </>
                )}
            </WysiwygComposer>
        </ComposerContext.Provider>
    );
}
