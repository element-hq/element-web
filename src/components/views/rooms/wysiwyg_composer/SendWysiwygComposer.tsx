/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type RefObject, useMemo, type ReactNode } from "react";
import { type IEventRelation } from "matrix-js-sdk/src/matrix";
import LockOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/lock-off";

import { useWysiwygSendActionHandler } from "./hooks/useWysiwygSendActionHandler";
import { WysiwygComposer } from "./components/WysiwygComposer";
import { PlainTextComposer } from "./components/PlainTextComposer";
import { type ComposerFunctions } from "./types";
import { E2EStatus } from "../../../../utils/ShieldUtils";
import E2EIcon from "../E2EIcon";
import { type MenuProps } from "../../../structures/ContextMenu";
import { Emoji } from "./components/Emoji";
import { ComposerContext, getDefaultContextValue } from "./ComposerContext";

interface ContentProps {
    disabled?: boolean;
    composerFunctions: ComposerFunctions;
    ref?: RefObject<HTMLElement | null>;
}

const Content = function Content({ disabled = false, composerFunctions, ref }: ContentProps): ReactNode {
    useWysiwygSendActionHandler(disabled, ref, composerFunctions);
    return null;
};

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

    let leftIcon: false | JSX.Element = false;
    if (!e2eStatus) {
        leftIcon = (
            <LockOffIcon
                data-testid="e2e-icon"
                width={12}
                height={12}
                color="var(--cpd-color-icon-info-primary)"
                className="mx_E2EIcon"
            />
        );
    } else if (e2eStatus !== E2EStatus.Normal) {
        leftIcon = <E2EIcon status={e2eStatus} />;
    }
    return (
        <ComposerContext.Provider value={defaultContextValue}>
            <Composer
                className="mx_SendWysiwygComposer"
                leftComponent={leftIcon}
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
