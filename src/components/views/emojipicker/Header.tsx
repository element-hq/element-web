/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";
import { findLastIndex } from "lodash";

import { _t } from "../../../languageHandler";
import { type CategoryKey, type ICategory } from "./Category";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";

interface IProps {
    categories: ICategory[];
    onAnchorClick(id: CategoryKey): void;
}

class Header extends React.PureComponent<IProps> {
    private findNearestEnabled(index: number, delta: number): number | undefined {
        index += this.props.categories.length;
        const cats = [...this.props.categories, ...this.props.categories, ...this.props.categories];

        while (index < cats.length && index >= 0) {
            if (cats[index].enabled) return index % this.props.categories.length;
            index += delta > 0 ? 1 : -1;
        }
    }

    private changeCategoryRelative(delta: number): void {
        let current: number;
        // As multiple categories may be visible at once, we want to find the one closest to the relative direction
        if (delta < 0) {
            current = this.props.categories.findIndex((c) => c.visible);
        } else {
            // XXX: Switch to Array::findLastIndex once we enable ES2023
            current = findLastIndex(this.props.categories, (c) => c.visible);
        }
        this.changeCategoryAbsolute(current + delta, delta);
    }

    private changeCategoryAbsolute(index: number, delta = 1): void {
        const category = this.props.categories[this.findNearestEnabled(index, delta)!];
        if (category) {
            this.props.onAnchorClick(category.id);
            category.ref.current?.focus();
        }
    }

    // Implements ARIA Tabs with Automatic Activation pattern
    // https://www.w3.org/TR/wai-aria-practices/examples/tabs/tabs-1/tabs.html
    private onKeyDown = (ev: React.KeyboardEvent): void => {
        let handled = true;

        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.ArrowLeft:
                this.changeCategoryRelative(-1);
                break;
            case KeyBindingAction.ArrowRight:
                this.changeCategoryRelative(1);
                break;

            case KeyBindingAction.Home:
                this.changeCategoryAbsolute(0);
                break;
            case KeyBindingAction.End:
                this.changeCategoryAbsolute(this.props.categories.length - 1, -1);
                break;
            default:
                handled = false;
        }

        if (handled) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    };

    public render(): React.ReactNode {
        return (
            <nav
                className="mx_EmojiPicker_header"
                role="tablist"
                aria-label={_t("emoji|categories")}
                onKeyDown={this.onKeyDown}
            >
                {this.props.categories.map((category) => {
                    const classes = classNames(`mx_EmojiPicker_anchor mx_EmojiPicker_anchor_${category.id}`, {
                        mx_EmojiPicker_anchor_visible: category.visible,
                    });
                    // Properties of this button are also modified by EmojiPicker's updateVisibility in DOM.
                    return (
                        <button
                            disabled={!category.enabled}
                            key={category.id}
                            ref={category.ref}
                            className={classes}
                            onClick={() => this.props.onAnchorClick(category.id)}
                            title={category.name}
                            role="tab"
                            tabIndex={category.visible ? 0 : -1} // roving
                            aria-selected={category.visible}
                            aria-controls={`mx_EmojiPicker_category_${category.id}`}
                        />
                    );
                })}
            </nav>
        );
    }
}

export default Header;
