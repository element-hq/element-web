/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { createContext, useContext } from "react";
import { IEventRelation } from "matrix-js-sdk/src/matrix";

import { SubSelection } from "./types";
import EditorStateTransfer from "../../../../utils/EditorStateTransfer";

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
