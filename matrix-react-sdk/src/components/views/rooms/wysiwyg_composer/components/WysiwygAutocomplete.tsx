/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React, { ForwardedRef, forwardRef } from "react";
import { FormattingFunctions, MappedSuggestion } from "@matrix-org/matrix-wysiwyg";

import { useRoomContext } from "../../../../../contexts/RoomContext";
import Autocomplete from "../../Autocomplete";
import { ICompletion } from "../../../../../autocomplete/Autocompleter";
import { useMatrixClientContext } from "../../../../../contexts/MatrixClientContext";
import { getMentionDisplayText, getMentionAttributes, buildQuery } from "../utils/autocomplete";

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
        { suggestion, handleMention, handleCommand }: WysiwygAutocompleteProps,
        ref: ForwardedRef<Autocomplete>,
    ): JSX.Element | null => {
        const { room } = useRoomContext();
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
                    // TODO improve handling of at-room to either become a span or use a placeholder href
                    // We have an issue in that we can't use a placeholder because the rust model is always
                    // applying a prefix to the href, so an href of "#" becomes https://# and also we can not
                    // represent a plain span in rust
                    handleMention(
                        window.location.href,
                        getMentionDisplayText(completion, client),
                        getMentionAttributes(completion, client, room),
                    );
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

        // TODO - determine if we show all of the /command suggestions, there are some options in the
        // list which don't seem to make sense in this context, specifically /html and /plain
        return room ? (
            <div className="mx_WysiwygComposer_AutoCompleteWrapper" data-testid="autocomplete-wrapper">
                <Autocomplete
                    ref={ref}
                    query={buildQuery(suggestion)}
                    onConfirm={handleConfirm}
                    selection={{ start: 0, end: 0 }}
                    room={room}
                />
            </div>
        ) : null;
    },
);

WysiwygAutocomplete.displayName = "WysiwygAutocomplete";

export { WysiwygAutocomplete };
