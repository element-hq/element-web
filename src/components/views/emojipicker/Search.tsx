/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { RovingTabIndexContext } from "../../../accessibility/RovingTabIndex";

interface IProps {
    query: string;
    onChange(value: string): void;
    onEnter(): void;
    onKeyDown(event: React.KeyboardEvent): void;
}

class Search extends React.PureComponent<IProps> {
    public static contextType = RovingTabIndexContext;
    declare public context: React.ContextType<typeof RovingTabIndexContext>;

    private inputRef = React.createRef<HTMLInputElement>();

    public componentDidMount(): void {
        // For some reason, neither the autoFocus nor just calling focus() here worked, so here's a window.setTimeout
        window.setTimeout(() => this.inputRef.current?.focus(), 0);
    }

    private onKeyDown = (ev: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.Enter:
                this.props.onEnter();
                ev.stopPropagation();
                ev.preventDefault();
                break;

            default:
                this.props.onKeyDown(ev);
        }
    };

    public render(): React.ReactNode {
        let rightButton: JSX.Element;
        if (this.props.query) {
            rightButton = (
                <button
                    onClick={() => this.props.onChange("")}
                    className="mx_EmojiPicker_search_icon mx_EmojiPicker_search_clear"
                    title={_t("emoji_picker|cancel_search_label")}
                />
            );
        } else {
            rightButton = <span className="mx_EmojiPicker_search_icon" />;
        }

        return (
            <div className="mx_EmojiPicker_search">
                <input
                    autoFocus
                    type="text"
                    placeholder={_t("action|search")}
                    value={this.props.query}
                    onChange={(ev) => this.props.onChange(ev.target.value)}
                    onKeyDown={this.onKeyDown}
                    ref={this.inputRef}
                    aria-activedescendant={this.context.state.activeNode?.id}
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
