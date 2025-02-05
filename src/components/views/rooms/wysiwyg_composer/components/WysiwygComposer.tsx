/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, type MutableRefObject, type ReactNode, useEffect, useMemo, useRef } from "react";
import { type IEventRelation } from "matrix-js-sdk/src/matrix";
import { EMOTICON_TO_EMOJI } from "@matrix-org/emojibase-bindings";
import { useWysiwyg, type FormattingFunctions } from "@vector-im/matrix-wysiwyg";
import classNames from "classnames";

import type Autocomplete from "../../Autocomplete";
import { WysiwygAutocomplete } from "./WysiwygAutocomplete";
import { FormattingButtons } from "./FormattingButtons";
import { Editor } from "./Editor";
import { useInputEventProcessor } from "../hooks/useInputEventProcessor";
import { useSetCursorPosition } from "../hooks/useSetCursorPosition";
import { useIsFocused } from "../hooks/useIsFocused";
import defaultDispatcher from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import { parsePermalink } from "../../../../../utils/permalinks/Permalinks";
import { isNotNull } from "../../../../../Typeguards";
import { useSettingValue } from "../../../../../hooks/useSettings";
import { useScopedRoomContext } from "../../../../../contexts/ScopedRoomContext.tsx";

interface WysiwygComposerProps {
    disabled?: boolean;
    onChange: (content: string) => void;
    onSend: () => void;
    placeholder?: string;
    initialContent?: string;
    className?: string;
    leftComponent?: ReactNode;
    rightComponent?: ReactNode;
    children?: (ref: MutableRefObject<HTMLDivElement | null>, wysiwyg: FormattingFunctions) => ReactNode;
    eventRelation?: IEventRelation;
}

function getEmojiSuggestions(enabled: boolean): Map<string, string> {
    const emojiSuggestions = new Map(Array.from(EMOTICON_TO_EMOJI, ([key, value]) => [key, value.unicode]));
    return enabled ? emojiSuggestions : new Map();
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
    const { room } = useScopedRoomContext("room");
    const autocompleteRef = useRef<Autocomplete | null>(null);

    const inputEventProcessor = useInputEventProcessor(onSend, autocompleteRef, initialContent, eventRelation);

    const isAutoReplaceEmojiEnabled = useSettingValue("MessageComposerInput.autoReplaceEmoji");
    const emojiSuggestions = useMemo(() => getEmojiSuggestions(isAutoReplaceEmojiEnabled), [isAutoReplaceEmojiEnabled]);

    const { ref, isWysiwygReady, content, actionStates, wysiwyg, suggestion, messageContent } = useWysiwyg({
        initialContent,
        inputEventProcessor,
        emojiSuggestions,
    });

    const { isFocused, onFocus } = useIsFocused();

    const isReady = isWysiwygReady && !disabled;
    const computedPlaceholder = (!content && placeholder) || undefined;

    useSetCursorPosition(!isReady, ref);

    useEffect(() => {
        if (!disabled && isNotNull(messageContent)) {
            onChange(messageContent);
        }
    }, [onChange, messageContent, disabled]);

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
                handleAtRoomMention={wysiwyg.mentionAtRoom}
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
