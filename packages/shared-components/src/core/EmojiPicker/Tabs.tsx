/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useRef } from "react";
import classNames from "classnames";

import { _t } from "../i18n/i18n";
import { RovingAction, type RovingTabIndexProviderProps } from "../roving";
import { type CategoryKey, type Category } from "./EmojiPicker";
import styles from "./EmojiPicker.module.css";

interface IProps {
    categories: Category[];
    enabledCategories: CategoryKey[];
    selectedCategory: CategoryKey;
    onAnchorClick: (id: CategoryKey) => void;
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

/**
 * The tab bar at the top of the emoji picker with a tab for each category.
 */
const Tabs: React.FC<IProps> = ({ categories, enabledCategories, selectedCategory, onAnchorClick, getAction }) => {
    const findNearestEnabled = useCallback(
        (index: number, delta: number): number | undefined => {
            index += categories.length;
            const cats = [...categories, ...categories, ...categories];

            while (index < cats.length && index >= 0) {
                if (enabledCategories.includes(cats[index].id)) return index % categories.length;
                index += delta > 0 ? 1 : -1;
            }
        },
        [categories, enabledCategories],
    );

    const changeCategoryAbsolute = useCallback(
        (index: number, delta = 1): void => {
            const category = categories[findNearestEnabled(index, delta)!];
            if (category) {
                onAnchorClick(category.id);
                tabRefs.current[category.id]?.current?.focus();
            }
        },
        [categories, findNearestEnabled, onAnchorClick],
    );

    const changeCategoryRelative = useCallback(
        (delta: number): void => {
            // Move to the next/previous category using the selected as the current.
            const current = categories.findIndex((c) => c.id === selectedCategory);
            changeCategoryAbsolute(current + delta, delta);
        },
        [categories, selectedCategory, changeCategoryAbsolute],
    );

    // Implements ARIA Tabs with Automatic Activation pattern
    // https://www.w3.org/TR/wai-aria-practices/examples/tabs/tabs-1/tabs.html
    const onKeyDown = useCallback(
        (ev: React.KeyboardEvent): void => {
            let handled = true;

            const action = getAction?.(ev) ?? getDefaultAction(ev);
            switch (action) {
                case RovingAction.ArrowLeft:
                    changeCategoryRelative(-1);
                    break;
                case RovingAction.ArrowRight:
                    changeCategoryRelative(1);
                    break;

                case RovingAction.Home:
                    changeCategoryAbsolute(0);
                    break;
                case RovingAction.End:
                    changeCategoryAbsolute(categories.length - 1, -1);
                    break;
                default:
                    handled = false;
            }

            if (handled) {
                ev.preventDefault();
                ev.stopPropagation();
            }
        },
        [getAction, changeCategoryRelative, changeCategoryAbsolute, categories.length],
    );

    const tabRefs = useRef({} as Record<CategoryKey, React.RefObject<HTMLButtonElement | null>>);
    if (!tabRefs.current.recent) {
        for (const category of categories) {
            tabRefs.current[category.id] = React.createRef<HTMLButtonElement>();
        }
    }

    return (
        <nav className={styles.header} role="tablist" aria-label={_t("emoji|categories")} onKeyDown={onKeyDown}>
            {categories.map((category) => {
                const classes = classNames(styles.anchor, {
                    [styles.anchorSelected]: category.id === selectedCategory,
                });
                // Properties of this button are also modified by EmojiPicker's updateVisibility in DOM.
                return (
                    <button
                        disabled={!enabledCategories.includes(category.id)}
                        key={category.id}
                        ref={tabRefs.current[category.id]}
                        className={classes}
                        onClick={() => onAnchorClick(category.id)}
                        title={_t(category.untranslatedName)}
                        role="tab"
                        tabIndex={category.id === selectedCategory ? 0 : -1} // roving
                        aria-selected={category.id === selectedCategory}
                        aria-controls={`mx_EmojiPicker_category_${category.id}`}
                    >
                        {category.emoji}
                    </button>
                );
            })}
        </nav>
    );
};

export default Tabs;
