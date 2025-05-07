/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { createContext, useContext } from "react";
import { type IEventRelation } from "matrix-js-sdk/src/matrix";

import { type SubSelection } from "./types";
import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";

export function getDefaultContextValue(defaultValue?: Partial<ComposerContextState>): { selection: SubSelection } {
    return {
        selection: { anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0, isForward: true },
        ...defaultValue,
    };
}

export interface ComposerContextState {
    selection: SubSelection;
    editorStateTransfer?: EditorStateTransfer;
    eventRelation?: IEventRelation;
}

export const ComposerContext = createContext<ComposerContextState>(getDefaultContextValue());
ComposerContext.displayName = "ComposerContext";

export function useComposerContext(): ComposerContextState {
    return useContext(ComposerContext);
}
