/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ForwardedRef, forwardRef, type MutableRefObject, useMemo } from "react";
import { type IEventRelation } from "matrix-js-sdk/src/matrix";

import { useWysiwygSendActionHandler } from "./hooks/useWysiwygSendActionHandler";
import { WysiwygComposer } from "./components/WysiwygComposer";
import { PlainTextComposer } from "./components/PlainTextComposer";
import { type ComposerFunctions } from "./types";
import { type E2EStatus } from "../../../../utils/ShieldUtils";
import E2EIcon from "../E2EIcon";
import { type MenuProps } from "../../../structures/ContextMenu";
import { Emoji } from "./components/Emoji";
import { ComposerContext, getDefaultContextValue } from "./ComposerContext";

interface ContentProps {
    disabled?: boolean;
    composerFunctions: ComposerFunctions;
}

const Content = forwardRef<HTMLElement, ContentProps>(function Content(
    { disabled = false, composerFunctions }: ContentProps,
    forwardRef: ForwardedRef<HTMLElement>,
) {
    useWysiwygSendActionHandler(disabled, forwardRef as MutableRefObject<HTMLElement>, composerFunctions);
    return null;
});

export interface SendWysiwygComposerProps {
    initialContent?: string;
    isRichTextEnabled: boolean;
    placeholder?: string;
    disabled?: boolean;
    e2eStatus?: E2EStatus;
    onChange: (content: string) => void;
    onSend: () => void;
    menuPosition: MenuProps;
    eventRelation?: IEventRelation;
}

// Default needed for React.lazy
export default function SendWysiwygComposer({
    isRichTextEnabled,
    e2eStatus,
    menuPosition,
    ...props
}: SendWysiwygComposerProps): JSX.Element {
    const Composer = isRichTextEnabled ? WysiwygComposer : PlainTextComposer;
    const defaultContextValue = useMemo(
        () => getDefaultContextValue({ eventRelation: props.eventRelation }),
        [props.eventRelation],
    );

    return (
        <ComposerContext.Provider value={defaultContextValue}>
            <Composer
                className="mx_SendWysiwygComposer"
                leftComponent={e2eStatus && <E2EIcon status={e2eStatus} />}
                rightComponent={<Emoji menuPosition={menuPosition} />}
                {...props}
            >
                {(ref, composerFunctions) => (
                    <Content disabled={props.disabled} ref={ref} composerFunctions={composerFunctions} />
                )}
            </Composer>
        </ComposerContext.Provider>
    );
}
