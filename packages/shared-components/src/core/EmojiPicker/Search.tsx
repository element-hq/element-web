/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useContext, useEffect } from "react";
import { CloseIcon, SearchIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../i18n/i18n";
import { RovingTabIndexContext } from "../roving";
import styles from "./EmojiPicker.module.css";

interface IProps {
    /**
     * The current search query.
     */
    query: string;
    /**
     * Called when the search query changes.
     *
     * @param value - The new search query
     */
    onChange: (value: string) => void;
    /**
     * Called when the Enter key is pressed in the search input.
     */
    onEnter: () => void;
    /**
     * Called when a key is pressed in the search input.
     *
     * @param event - The keyboard event
     */
    onKeyDown: (event: React.KeyboardEvent) => void;
    /**
     * The id of the element that this search box controls, for aria-controls.
     */
    controlsId: string;
    /**
     * Ref to the search input, owned by the picker so it can inspect focus.
     */
    inputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * The search input at the top of the emoji picker.
 */
export const Search: React.FC<IProps> = ({ query, onChange, onEnter, onKeyDown, inputRef, controlsId }) => {
    const context = useContext(RovingTabIndexContext);

    // This component gets mounted in a number of different places where the autoFocus attribute doesn't
    // work, so focus the search box manually.
    useEffect(() => {
        inputRef.current?.focus();
    }, [inputRef]);

    const onInputKeyDown = useCallback(
        (ev: React.KeyboardEvent): void => {
            if (ev.key === "Enter") {
                onEnter();
                ev.stopPropagation();
                ev.preventDefault();
            } else {
                onKeyDown(ev);
            }
        },
        [onEnter, onKeyDown],
    );

    let rightButton: JSX.Element;
    if (query) {
        rightButton = (
            <button onClick={() => onChange("")} title={_t("emoji_picker|cancel_search_label")}>
                <CloseIcon />
            </button>
        );
    } else {
        rightButton = (
            <span className={styles.searchIcon}>
                <SearchIcon />
            </span>
        );
    }

    return (
        <div className={styles.search}>
            <input
                autoFocus
                type="text"
                placeholder={_t("action|search")}
                aria-label={_t("action|search")}
                value={query}
                onChange={(ev) => onChange(ev.target.value)}
                onKeyDown={onInputKeyDown}
                ref={inputRef}
                // Setting aria-activedescendant on the input allows screen readers to identify the active emoji.
                // Setting it when there is not a query causes screen readers to read out the first emoji when focusing the input, and it continually tells you you are in the table vs the input.
                aria-activedescendant={query ? context.state.activeNode?.id : undefined}
                aria-controls={controlsId}
                aria-haspopup="grid"
                aria-autocomplete="list"
            />
            {rightButton}
        </div>
    );
};
