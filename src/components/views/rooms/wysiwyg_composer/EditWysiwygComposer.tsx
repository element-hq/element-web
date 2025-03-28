/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ForwardedRef, forwardRef, type RefObject, useMemo } from "react";
import classNames from "classnames";

import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import { WysiwygComposer } from "./components/WysiwygComposer";
import { EditionButtons } from "./components/EditionButtons";
import { useWysiwygEditActionHandler } from "./hooks/useWysiwygEditActionHandler";
import { useEditing } from "./hooks/useEditing";
import { useInitialContent } from "./hooks/useInitialContent";
import { ComposerContext, getDefaultContextValue } from "./ComposerContext";
import { type ComposerFunctions } from "./types";

interface ContentProps {
    disabled?: boolean;
    composerFunctions: ComposerFunctions;
}

const Content = forwardRef<HTMLElement, ContentProps>(function Content(
    { disabled = false, composerFunctions }: ContentProps,
    forwardRef: ForwardedRef<HTMLElement>,
) {
    useWysiwygEditActionHandler(disabled, forwardRef as RefObject<HTMLElement>, composerFunctions);
    return null;
});

interface EditWysiwygComposerProps {
    disabled?: boolean;
    onChange?: (content: string) => void;
    editorStateTransfer: EditorStateTransfer;
    className?: string;
}

// Default needed for React.lazy
export default function EditWysiwygComposer({
    editorStateTransfer,
    className,
    ...props
}: EditWysiwygComposerProps): JSX.Element {
    const defaultContextValue = useMemo(() => getDefaultContextValue({ editorStateTransfer }), [editorStateTransfer]);
    const initialContent = useInitialContent(editorStateTransfer);
    const isReady = !editorStateTransfer || initialContent !== undefined;

    const { editMessage, endEditing, onChange, isSaveDisabled } = useEditing(editorStateTransfer, initialContent);

    if (!isReady) {
        return <></>;
    }

    return (
        <ComposerContext.Provider value={defaultContextValue}>
            <WysiwygComposer
                className={classNames("mx_EditWysiwygComposer", className)}
                initialContent={initialContent}
                onChange={onChange}
                onSend={editMessage}
                {...props}
            >
                {(ref, composerFunctions) => (
                    <>
                        <Content disabled={props.disabled} ref={ref} composerFunctions={composerFunctions} />
                        <EditionButtons
                            onCancelClick={endEditing}
                            onSaveClick={editMessage}
                            isSaveDisabled={isSaveDisabled}
                        />
                    </>
                )}
            </WysiwygComposer>
        </ComposerContext.Provider>
    );
}
