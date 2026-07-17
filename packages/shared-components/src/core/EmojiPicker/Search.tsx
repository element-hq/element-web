/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { CloseIcon, SearchIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../i18n/i18n";
import { RovingTabIndexContext } from "../roving";
import styles from "./EmojiPicker.module.css";

interface IProps {
    query: string;
    onChange(value: string): void;
    onEnter(): void;
    onKeyDown(event: React.KeyboardEvent): void;
    /** Ref to the search input, owned by the picker so it can inspect focus. */
    inputRef: React.RefObject<HTMLInputElement | null>;
}

class Search extends React.PureComponent<IProps> {
    public static contextType = RovingTabIndexContext;
    declare public context: React.ContextType<typeof RovingTabIndexContext>;

    public componentDidMount(): void {
        // For some reason, neither the autoFocus nor just calling focus() here worked, so here's a window.setTimeout
        window.setTimeout(() => this.props.inputRef.current?.focus(), 0);
    }

    private onKeyDown = (ev: React.KeyboardEvent): void => {
        if (ev.key === "Enter") {
            this.props.onEnter();
            ev.stopPropagation();
            ev.preventDefault();
        } else {
            this.props.onKeyDown(ev);
        }
    };

    public render(): React.ReactNode {
        let rightButton: JSX.Element;
        if (this.props.query) {
            rightButton = (
                <button onClick={() => this.props.onChange("")} title={_t("emoji_picker|cancel_search_label")}>
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
                    value={this.props.query}
                    onChange={(ev) => this.props.onChange(ev.target.value)}
                    onKeyDown={this.onKeyDown}
                    ref={this.props.inputRef}
                    // Setting aria-activedescendant on the input allows screen readers to identify the active emoji.
                    // Setting it when there is not a query causes screen readers to read out the first emoji when focusing the input, and it continually tells you you are in the table vs the input.
                    aria-activedescendant={this.props.query ? this.context.state.activeNode?.id : undefined}
                    aria-controls="mx_EmojiPicker_body"
                    aria-haspopup="grid"
                    aria-autocomplete="list"
                />
                {rightButton}
            </div>
        );
    }
}

export default Search;
