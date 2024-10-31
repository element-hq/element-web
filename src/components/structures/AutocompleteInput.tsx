/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useState, ReactNode, ChangeEvent, KeyboardEvent, useRef, ReactElement } from "react";
import classNames from "classnames";
import { SearchIcon, CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import Autocompleter from "../../autocomplete/AutocompleteProvider";
import { Key } from "../../Keyboard";
import { ICompletion } from "../../autocomplete/Autocompleter";
import AccessibleButton from "../../components/views/elements/AccessibleButton";
import useFocus from "../../hooks/useFocus";

interface AutocompleteInputProps {
    provider: Autocompleter;
    placeholder: string;
    selection: ICompletion[];
    onSelectionChange: (selection: ICompletion[]) => void;
    maxSuggestions?: number;
    renderSuggestion?: (s: ICompletion) => ReactElement;
    renderSelection?: (m: ICompletion) => ReactElement;
    additionalFilter?: (suggestion: ICompletion) => boolean;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
    provider,
    renderSuggestion,
    renderSelection,
    maxSuggestions = 5,
    placeholder,
    onSelectionChange,
    selection,
    additionalFilter,
}) => {
    const [query, setQuery] = useState<string>("");
    const [suggestions, setSuggestions] = useState<ICompletion[]>([]);
    const [isFocused, onFocusChangeHandlerFunctions] = useFocus();
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLInputElement>(null);

    const focusEditor = (): void => {
        editorRef?.current?.focus();
    };

    const onQueryChange = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const value = e.target.value.trim();
        setQuery(value);

        let matches = await provider.getCompletions(
            query,
            { start: query.length, end: query.length },
            true,
            maxSuggestions,
        );

        if (additionalFilter) {
            matches = matches.filter(additionalFilter);
        }

        setSuggestions(matches);
    };

    const onClickInputArea = (): void => {
        focusEditor();
    };

    const onKeyDown = (e: KeyboardEvent): void => {
        const hasModifiers = e.ctrlKey || e.shiftKey || e.metaKey;

        // when the field is empty and the user hits backspace remove the right-most target
        if (!query && selection.length > 0 && e.key === Key.BACKSPACE && !hasModifiers) {
            removeSelection(selection[selection.length - 1]);
        }
    };

    const toggleSelection = (completion: ICompletion): void => {
        const newSelection = [...selection];
        const index = selection.findIndex((selection) => selection.completionId === completion.completionId);

        if (index >= 0) {
            newSelection.splice(index, 1);
        } else {
            newSelection.push(completion);
        }

        onSelectionChange(newSelection);
        focusEditor();
        setQuery("");
        setSuggestions([]);
    };

    const removeSelection = (completion: ICompletion): void => {
        const newSelection = [...selection];
        const index = selection.findIndex((selection) => selection.completionId === completion.completionId);

        if (index >= 0) {
            newSelection.splice(index, 1);
            onSelectionChange(newSelection);
        }
    };

    const hasPlaceholder = (): boolean => selection.length === 0 && query.length === 0;

    return (
        <div className="mx_AutocompleteInput">
            <div
                ref={editorContainerRef}
                className={classNames({
                    "mx_AutocompleteInput_editor": true,
                    "mx_AutocompleteInput_editor--focused": isFocused,
                    "mx_AutocompleteInput_editor--has-suggestions": suggestions.length > 0,
                })}
                onClick={onClickInputArea}
                data-testid="autocomplete-editor"
            >
                <SearchIcon className="mx_AutocompleteInput_search_icon" width="18px" height="18px" />
                {selection.map((item) => (
                    <SelectionItem
                        key={item.completionId}
                        item={item}
                        onClick={removeSelection}
                        render={renderSelection}
                    />
                ))}
                <input
                    ref={editorRef}
                    type="text"
                    onKeyDown={onKeyDown}
                    onChange={onQueryChange}
                    value={query}
                    autoComplete="off"
                    placeholder={hasPlaceholder() ? placeholder : undefined}
                    data-testid="autocomplete-input"
                    {...onFocusChangeHandlerFunctions}
                />
            </div>
            {isFocused && suggestions.length ? (
                <div
                    className="mx_AutocompleteInput_matches"
                    style={{ top: editorContainerRef.current?.clientHeight }}
                    data-testid="autocomplete-matches"
                >
                    {suggestions.map((item) => (
                        <SuggestionItem
                            key={item.completionId}
                            item={item}
                            selection={selection}
                            onClick={toggleSelection}
                            render={renderSuggestion}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
};

type SelectionItemProps = {
    item: ICompletion;
    onClick: (completion: ICompletion) => void;
    render?: (completion: ICompletion) => ReactElement;
};

const SelectionItem: React.FC<SelectionItemProps> = ({ item, onClick, render }) => {
    const withContainer = (children: ReactNode): ReactElement => (
        <span
            className="mx_AutocompleteInput_editor_selection"
            data-testid={`autocomplete-selection-item-${item.completionId}`}
        >
            <span className="mx_AutocompleteInput_editor_selection_pill">{children}</span>
            <AccessibleButton
                className="mx_AutocompleteInput_editor_selection_remove_button"
                onClick={() => onClick(item)}
                data-testid={`autocomplete-selection-remove-button-${item.completionId}`}
            >
                <CloseIcon width="16px" height="16px" />
            </AccessibleButton>
        </span>
    );

    if (render) {
        return withContainer(render(item));
    }

    return withContainer(<span className="mx_AutocompleteInput_editor_selection_text">{item.completion}</span>);
};

type SuggestionItemProps = {
    item: ICompletion;
    selection: ICompletion[];
    onClick: (completion: ICompletion) => void;
    render?: (completion: ICompletion) => ReactElement;
};

const SuggestionItem: React.FC<SuggestionItemProps> = ({ item, selection, onClick, render }) => {
    const isSelected = selection.some((selection) => selection.completionId === item.completionId);
    const classes = classNames({
        "mx_AutocompleteInput_suggestion": true,
        "mx_AutocompleteInput_suggestion--selected": isSelected,
    });

    const withContainer = (children: ReactNode): ReactElement => (
        <div
            className={classes}
            // `onClick` cannot be used here as it would lead to focus loss and closing the suggestion list.
            onMouseDown={(event) => {
                event.preventDefault();
                onClick(item);
            }}
            data-testid={`autocomplete-suggestion-item-${item.completionId}`}
        >
            {children}
        </div>
    );

    if (render) {
        return withContainer(render(item));
    }

    return withContainer(
        <>
            <span className="mx_AutocompleteInput_suggestion_title">{item.completion}</span>
            <span className="mx_AutocompleteInput_suggestion_description">{item.completionId}</span>
        </>,
    );
};
