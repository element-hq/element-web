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

import classNames from "classnames";
import React, { CSSProperties, forwardRef, memo, MutableRefObject, ReactNode } from "react";

import { useIsExpanded } from "../hooks/useIsExpanded";
import { useSelection } from "../hooks/useSelection";

const HEIGHT_BREAKING_POINT = 24;

interface EditorProps {
    disabled: boolean;
    placeholder?: string;
    leftComponent?: ReactNode;
    rightComponent?: ReactNode;
}

export const Editor = memo(
    forwardRef<HTMLDivElement, EditorProps>(function Editor(
        { disabled, placeholder, leftComponent, rightComponent }: EditorProps,
        ref,
    ) {
        const isExpanded = useIsExpanded(ref as MutableRefObject<HTMLDivElement | null>, HEIGHT_BREAKING_POINT);
        const { onFocus, onBlur, onInput } = useSelection();

        return (
            <div
                data-testid="WysiwygComposerEditor"
                className="mx_WysiwygComposer_Editor"
                data-is-expanded={isExpanded}
            >
                {leftComponent}
                <div className="mx_WysiwygComposer_Editor_container">
                    <div
                        className={classNames("mx_WysiwygComposer_Editor_content", {
                            mx_WysiwygComposer_Editor_content_placeholder: Boolean(placeholder),
                        })}
                        style={{ "--placeholder": `"${placeholder}"` } as CSSProperties}
                        ref={ref}
                        contentEditable={!disabled}
                        role="textbox"
                        aria-multiline="true"
                        aria-autocomplete="list"
                        aria-haspopup="listbox"
                        dir="auto"
                        aria-disabled={disabled}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        onInput={onInput}
                    />
                </div>
                {rightComponent}
            </div>
        );
    }),
);
