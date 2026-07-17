/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import classNames from "classnames";

import { _t } from "../i18n/i18n";
import { RovingAction, type RovingTabIndexProviderProps } from "../roving";
import { type CategoryKey, type ICategory } from "./Category";
import styles from "./EmojiPicker.module.css";

interface IProps {
    categories: ICategory[];
    onAnchorClick(id: CategoryKey): void;
    /**
     * Optional action resolver used to map keyboard events to
     * {@link RovingAction} values, e.g. to apply app-level custom keybindings.
     *
     * When omitted, a default mapping based on `KeyboardEvent.key` is used.
     */
    getAction?: RovingTabIndexProviderProps["getAction"];
}

const getDefaultAction = (ev: React.KeyboardEvent): RovingAction | undefined => {
    switch (ev.key) {
        case "ArrowLeft":
            return RovingAction.ArrowLeft;
        case "ArrowRight":
            return RovingAction.ArrowRight;
        case "Home":
            return RovingAction.Home;
        case "End":
            return RovingAction.End;
        default:
            return undefined;
    }
};

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
        // Move to the next/previous category using the first visible as the current.
        const current = this.props.categories.findIndex((c) => c.visible);
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

        const action = this.props.getAction?.(ev) ?? getDefaultAction(ev);
        switch (action) {
            case RovingAction.ArrowLeft:
                this.changeCategoryRelative(-1);
                break;
            case RovingAction.ArrowRight:
                this.changeCategoryRelative(1);
                break;

            case RovingAction.Home:
                this.changeCategoryAbsolute(0);
                break;
            case RovingAction.End:
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
            <nav className={styles.header} role="tablist" aria-label={_t("emoji|categories")} onKeyDown={this.onKeyDown}>
                {this.props.categories.map((category) => {
                    const classes = classNames(styles.anchor, {
                        [styles.anchorVisible]: category.visible,
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
                            tabIndex={category.firstVisible ? 0 : -1} // roving
                            aria-selected={category.visible}
                            aria-controls={`mx_EmojiPicker_category_${category.id}`}
                        >
                            {category.emoji}
                        </button>
                    );
                })}
            </nav>
        );
    }
}

export default Header;
