/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ForwardedRef, forwardRef, type FunctionComponent } from "react";
import { type FormattingFunctions, type MappedSuggestion } from "@vector-im/matrix-wysiwyg";
import { logger } from "matrix-js-sdk/src/logger";

import Autocomplete from "../../Autocomplete";
import { type ICompletion } from "../../../../../autocomplete/Autocompleter";
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { getMentionDisplayText, getMentionAttributes, buildQuery } from "../utils/autocomplete";
import { useScopedRoomContext } from "../../../../../contexts/ScopedRoomContext.tsx";

interface WysiwygAutocompleteProps {
    /**
     * The suggestion output from the rust model is used to build the query that is
     * passed to the `<Autocomplete />` component
     */
    suggestion: MappedSuggestion | null;

    /**
     * This handler will be called with the href and display text for a mention on clicking
     * a mention in the autocomplete list or pressing enter on a selected item
     */
    handleMention: FormattingFunctions["mention"];

    /**
     * This handler will be called with the display text for a command on clicking
     * a command in the autocomplete list or pressing enter on a selected item
     */
    handleCommand: FormattingFunctions["command"];

    /**
     * Handler purely for the at-room mentions special case
     */
    handleAtRoomMention: FormattingFunctions["mentionAtRoom"];
}

/**
 * Given the current suggestion from the rust model and a handler function, this component
 * will display the legacy `<Autocomplete />` component (as used in the BasicMessageComposer)
 * and call the handler function with the required arguments when a mention is selected
 *
 * @param props.ref - the ref will be attached to the rendered `<Autocomplete />` component
 */
const WysiwygAutocomplete = forwardRef(
    (
        { suggestion, handleMention, handleCommand, handleAtRoomMention }: WysiwygAutocompleteProps,
        ref: ForwardedRef<Autocomplete>,
    ): JSX.Element | null => {
        const { room } = useScopedRoomContext("room");
        const client = useMatrixClientContext();

        function handleConfirm(completion: ICompletion): void {
            if (client === undefined || room === undefined) {
                return;
            }

            switch (completion.type) {
                case "command": {
                    // TODO determine if utils in SlashCommands.tsx are required.
                    // Trim the completion as some include trailing spaces, but we always insert a
                    // trailing space in the rust model anyway
                    handleCommand(completion.completion.trim());
                    return;
                }
                case "at-room": {
                    handleAtRoomMention(getMentionAttributes(completion, client, room));
                    return;
                }
                case "room":
                case "user": {
                    if (typeof completion.href === "string") {
                        handleMention(
                            completion.href,
                            getMentionDisplayText(completion, client),
                            getMentionAttributes(completion, client, room),
                        );
                    }
                    return;
                }
                // TODO - handle "community" type
                default:
                    return;
            }
        }

        if (!room) return null;

        const autoCompleteQuery = buildQuery(suggestion);
        // debug for https://github.com/vector-im/element-web/issues/26037
        logger.log(`## 26037 ## Rendering Autocomplete for WysiwygAutocomplete with query: "${autoCompleteQuery}"`);

        // TODO - determine if we show all of the /command suggestions, there are some options in the
        // list which don't seem to make sense in this context, specifically /html and /plain
        return (
            <div className="mx_WysiwygComposer_AutoCompleteWrapper" data-testid="autocomplete-wrapper">
                <Autocomplete
                    ref={ref}
                    query={autoCompleteQuery}
                    onConfirm={handleConfirm}
                    selection={{ start: 0, end: 0 }}
                    room={room}
                />
            </div>
        );
    },
);

(WysiwygAutocomplete as FunctionComponent).displayName = "WysiwygAutocomplete";

export { WysiwygAutocomplete };
