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

import React, { memo, MutableRefObject, ReactNode, useEffect, useRef } from "react";
import { IEventRelation } from "matrix-js-sdk/src/matrix";
import { useWysiwyg, FormattingFunctions } from "@matrix-org/matrix-wysiwyg";
import classNames from "classnames";

import Autocomplete from "../../Autocomplete";
import { WysiwygAutocomplete } from "./WysiwygAutocomplete";
import { FormattingButtons } from "./FormattingButtons";
import { Editor } from "./Editor";
import { useInputEventProcessor } from "../hooks/useInputEventProcessor";
import { useSetCursorPosition } from "../hooks/useSetCursorPosition";
import { useIsFocused } from "../hooks/useIsFocused";
import { useRoomContext } from "../../../../../contexts/RoomContext";
import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import { parsePermalink } from "../../../../../utils/permalinks/Permalinks";

interface WysiwygComposerProps {
    disabled?: boolean;
    onChange?: (content: string) => void;
    onSend: () => void;
    placeholder?: string;
    initialContent?: string;
    className?: string;
    leftComponent?: ReactNode;
    rightComponent?: ReactNode;
    children?: (ref: MutableRefObject<HTMLDivElement | null>, wysiwyg: FormattingFunctions) => ReactNode;
    eventRelation?: IEventRelation;
}

export const WysiwygComposer = memo(function WysiwygComposer({
    disabled = false,
    onChange,
    onSend,
    placeholder,
    initialContent,
    className,
    leftComponent,
    rightComponent,
    children,
    eventRelation,
}: WysiwygComposerProps) {
    const { room } = useRoomContext();
    const autocompleteRef = useRef<Autocomplete | null>(null);

    const inputEventProcessor = useInputEventProcessor(onSend, autocompleteRef, initialContent, eventRelation);
    const { ref, isWysiwygReady, content, actionStates, wysiwyg, suggestion } = useWysiwyg({
        initialContent,
        inputEventProcessor,
    });
    const { isFocused, onFocus } = useIsFocused();

    const isReady = isWysiwygReady && !disabled;
    const computedPlaceholder = (!content && placeholder) || undefined;

    useSetCursorPosition(!isReady, ref);

    useEffect(() => {
        if (!disabled && content !== null) {
            onChange?.(content);
        }
    }, [onChange, content, disabled]);

    useEffect(() => {
        function handleClick(e: Event): void {
            e.preventDefault();
            if (
                e.target &&
                e.target instanceof HTMLAnchorElement &&
                e.target.getAttribute("data-mention-type") === "user"
            ) {
                const parsedLink = parsePermalink(e.target.href);
                if (room && parsedLink?.userId)
                    defaultDispatcher.dispatch({
                        action: Action.ViewUser,
                        member: room.getMember(parsedLink.userId),
                    });
            }
        }

        const mentions: NodeList | undefined = ref.current?.querySelectorAll("a[data-mention-type]");
        if (mentions) {
            mentions.forEach((mention) => mention.addEventListener("click", handleClick));
        }

        return () => {
            if (mentions) mentions.forEach((mention) => mention.removeEventListener("click", handleClick));
        };
    }, [ref, room, content]);

    return (
        <div
            data-testid="WysiwygComposer"
            className={classNames(className, { [`${className}-focused`]: isFocused })}
            onFocus={onFocus}
            onBlur={onFocus}
        >
            <WysiwygAutocomplete
                ref={autocompleteRef}
                suggestion={suggestion}
                handleMention={wysiwyg.mention}
                handleCommand={wysiwyg.command}
            />
            <FormattingButtons composer={wysiwyg} actionStates={actionStates} />
            <Editor
                ref={ref}
                disabled={!isReady}
                leftComponent={leftComponent}
                rightComponent={rightComponent}
                placeholder={computedPlaceholder}
            />
            {children?.(ref, wysiwyg)}
        </div>
    );
});
