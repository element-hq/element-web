/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type Dispatch, useCallback, useRef, useState } from "react";
import { DATA_BY_CATEGORY, getEmojiFromUnicode, type Emoji as IEmoji } from "@matrix-org/emojibase-bindings";
import classNames from "classnames";

import { _t } from "../i18n/i18n";
import { AutoHideScrollbar } from "../utils/Scrollbar";
import {
    type IAction as RovingAction,
    type IState as RovingState,
    RovingGridIndexProvider,
    RovingStateActionType,
    type RovingTabIndexProviderProps,
} from "../roving";
import Header from "./Header";
import Search from "./Search";
import Preview from "./Preview";
import QuickReactions from "./QuickReactions";
import Category, { type CategoryKey, type ICategory } from "./Category";
import { type ButtonEvent } from "./RovingButton";
import styles from "./EmojiPicker.module.css";

const ZERO_WIDTH_JOINER = "\u200D";

/**
 * Props for {@link EmojiPicker}.
 */
export interface EmojiPickerProps {
    /**
     * Set of which emojis are already selected and should be decorated as such.
     * If specified, emoji will use a checkbox role with aria-checked set appropriately.
     */
    selectedEmojis?: Set<string>;
    /**
     * Called when the user chooses an emoji.
     *
     * Return `false` to prevent the emoji being recorded as recently used.
     */
    onChoose: (unicode: string) => boolean;
    /**
     * Called when the picker is done, e.g. an emoji was chosen with Enter.
     */
    onFinished: () => void;
    /**
     * Returns whether the emoji with the given unicode should be disabled.
     */
    isEmojiDisabled?: (unicode: string) => boolean;
    /**
     * Recently used emoji (unicode strings, most relevant first) to show in the
     * "Frequently Used" category. The category is hidden when empty or omitted.
     */
    recentEmojis?: string[];
    /**
     * Called with the chosen emoji unicode when it should be recorded as
     * recently used, i.e. when {@link onChoose} did not return `false`.
     */
    onRecordRecent?: (unicode: string) => void;
    /**
     * Optional action resolver used to map keyboard events to roving actions,
     * e.g. to apply app-level custom keybindings.
     *
     * When omitted, a default mapping based on `KeyboardEvent.key` is used.
     */
    getAction?: RovingTabIndexProviderProps["getAction"];
}

/**
 * The emoji data derived from the initial props. These objects are mutated in
 * place (e.g. category visibility/enabled state, memoized filtered emoji) to
 * avoid re-rendering on scroll and while filtering, so they are created once
 * and kept stable across renders.
 */
interface EmojiPickerData {
    recentlyUsed: IEmoji[];
    memoizedDataByCategory: Record<CategoryKey, IEmoji[]>;
    categories: ICategory[];
}

export function createEmojiPickerData(recentEmojis: string[] | undefined): EmojiPickerData {
    // Convert recent emoji characters to emoji data, removing unknowns and duplicates
    const recentlyUsed = Array.from(
        new Set((recentEmojis ?? []).map(getEmojiFromUnicode).filter((emoji): emoji is IEmoji => !!emoji)),
    );
    const memoizedDataByCategory: Record<CategoryKey, IEmoji[]> = {
        recent: recentlyUsed,
        ...DATA_BY_CATEGORY,
    };

    const hasRecentlyUsed = recentlyUsed.length > 0;

    const categoryConfig: Pick<ICategory, "id" | "name" | "emoji">[] = [
        { id: "recent", name: _t("emoji|category_frequently_used"), emoji: "🕒" },
        { id: "people", name: _t("emoji|category_smileys_people"), emoji: "😀" },
        { id: "nature", name: _t("emoji|category_animals_nature"), emoji: "🐕" },
        { id: "foods", name: _t("emoji|category_food_drink"), emoji: "🍎" },
        { id: "activity", name: _t("emoji|category_activities"), emoji: "⚽️" },
        { id: "places", name: _t("emoji|category_travel_places"), emoji: "🚗" },
        { id: "objects", name: _t("emoji|category_objects"), emoji: "💡" },
        { id: "symbols", name: _t("emoji|category_symbols"), emoji: "⁉️" },
        { id: "flags", name: _t("emoji|category_flags"), emoji: "🏁" },
    ];

    const categories = categoryConfig.map((config) => {
        let isEnabled = true;
        let isVisible = false;
        let firstVisible = false;
        if (config.id === "recent") {
            isEnabled = hasRecentlyUsed;
            isVisible = hasRecentlyUsed;
            firstVisible = hasRecentlyUsed;
        } else if (config.id === "people") {
            isVisible = true;
            firstVisible = !hasRecentlyUsed;
        }
        return {
            ...config,
            enabled: isEnabled,
            visible: isVisible,
            firstVisible: firstVisible,
            ref: React.createRef(),
        } satisfies ICategory;
    });

    return { recentlyUsed, memoizedDataByCategory, categories };
}

function emojiMatchesFilter(emoji: IEmoji, filter: string): boolean {
    // If the query is an emoji containing a variation then strip it to provide more useful matches
    if (filter.includes(ZERO_WIDTH_JOINER)) {
        filter = filter.split(ZERO_WIDTH_JOINER, 2)[0];
    }
    return (
        emoji.label.toLowerCase().includes(filter) ||
        (Array.isArray(emoji.emoticon)
            ? emoji.emoticon.some((x) => x.includes(filter))
            : emoji.emoticon?.includes(filter)) ||
        emoji.shortcodes.some((x) => x.toLowerCase().includes(filter)) ||
        emoji.unicode.split(ZERO_WIDTH_JOINER).includes(filter)
    );
}

/**
 * Filter the given emoji by the (already lower-cased and trimmed) query and
 * sort matches so the most relevant shortcodes come first. Returns the input
 * unchanged when the filter is empty. Never mutates the input array.
 */
export function filterEmojis(emojis: IEmoji[], lcFilter: string): IEmoji[] {
    if (lcFilter === "") return emojis;

    return emojis
        .filter((emoji) => emojiMatchesFilter(emoji, lcFilter))
        .sort((a, b) => {
            const indexA = a.shortcodes[0].indexOf(lcFilter);
            const indexB = b.shortcodes[0].indexOf(lcFilter);

            // Prioritize emojis containing the filter in its shortcode
            if (indexA == -1 || indexB == -1) {
                return indexB - indexA;
            }

            // If both emojis start with the filter
            // put the shorter emoji first
            if (indexA == 0 && indexB == 0) {
                return a.shortcodes[0].length - b.shortcodes[0].length;
            }

            // Prioritize emojis starting with the filter
            return indexA - indexB;
        });
}

/**
 * A searchable emoji picker with categories, quick reactions and keyboard
 * (roving grid) navigation.
 */
export function EmojiPicker({
    selectedEmojis,
    onChoose,
    onFinished,
    isEmojiDisabled,
    recentEmojis,
    onRecordRecent,
    getAction,
}: EmojiPickerProps): React.ReactNode {
    const [filter, setFilter] = useState("");
    const [previewEmoji, setPreviewEmoji] = useState<IEmoji | undefined>(undefined);
    // Track if user has interacted with arrow keys or search
    const [showHighlight, setShowHighlight] = useState(false);
    // The scroll container of the picker body, once mounted. Shared with each
    // category so their virtualized rows can window against it.
    const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

    const searchRef = useRef<HTMLInputElement>(null);

    // Created once from the initial props and mutated in place thereafter.
    const dataRef = useRef<EmojiPickerData | null>(null);
    if (dataRef.current === null) {
        dataRef.current = createEmojiPickerData(recentEmojis);
    }
    const { recentlyUsed, memoizedDataByCategory, categories } = dataRef.current;

    const collectScrollElement = useCallback((ref: HTMLDivElement | null): void => {
        setScrollElement(ref);
    }, []);

    const updateVisibility = useCallback((): void => {
        const body = scrollElement;
        if (!body) return;
        const rect = body.getBoundingClientRect();
        let firstVisibleFound = false;
        for (const cat of categories) {
            const elem = body.querySelector(`[data-category-id="${cat.id}"]`);
            if (!elem) {
                cat.visible = false;
                cat.ref.current?.classList.remove(styles.anchorVisible);
                continue;
            }
            const elemRect = elem.getBoundingClientRect();
            const y = elemRect.y - rect.y;
            const yEnd = elemRect.y + elemRect.height - rect.y;
            cat.visible = y < rect.height && yEnd > 0;
            if (cat.visible && !firstVisibleFound) {
                firstVisibleFound = true;
                cat.firstVisible = true;
            } else {
                cat.firstVisible = false;
            }
            // We update this here instead of through React to avoid re-render on scroll.
            if (!cat.ref.current) continue;
            if (cat.visible) {
                cat.ref.current.classList.add(styles.anchorVisible);
                cat.ref.current.setAttribute("aria-selected", "true");
            } else {
                cat.ref.current.classList.remove(styles.anchorVisible);
                cat.ref.current.setAttribute("aria-selected", "false");
            }
            if (cat.firstVisible) {
                cat.ref.current.setAttribute("tabindex", "0");
            } else {
                cat.ref.current.setAttribute("tabindex", "-1");
            }
        }
    }, [scrollElement, categories]);

    const onScroll = useCallback((): void => {
        updateVisibility();
    }, [updateVisibility]);

    // Given a roving emoji button returns the role=gridcell element containing it
    const getGridcell = useCallback((rovingNode?: Element): Element | undefined => {
        return rovingNode?.parentElement ?? undefined;
    }, []);

    // Given a roving emoji button returns the role=row element containing it
    const getRow = useCallback(
        (rovingNode?: Element): Element | undefined => {
            return getGridcell(rovingNode)?.parentElement ?? undefined;
        },
        [getGridcell],
    );

    // Given a role=gridcell node returns the roving emoji button contained within
    const getRovingNode = useCallback((gridcellNode: Element): HTMLElement | undefined => {
        const node = gridcellNode.children[0];
        return node instanceof HTMLElement ? node : undefined;
    }, []);

    const onKeyDown = useCallback(
        (ev: React.KeyboardEvent, state: RovingState, dispatch: Dispatch<RovingAction>): void => {
            if (state.activeNode && ["ArrowDown", "ArrowRight", "ArrowLeft", "ArrowUp"].includes(ev.key)) {
                // If highlight is not shown yet, show it and reset to first emoji
                if (!showHighlight) {
                    setShowHighlight(true);
                    // Reset to first emoji when showing highlight for the first time (or after it was hidden)
                    if (state.nodes.length > 0) {
                        dispatch({
                            type: RovingStateActionType.SetFocus,
                            payload: { node: state.nodes[0] },
                        });
                    }
                    ev.preventDefault();
                    ev.stopPropagation();
                    return;
                }
            }
        },
        [showHighlight],
    );

    const shouldMoveFocus = useCallback((): boolean => {
        return document.activeElement !== searchRef.current;
    }, []);

    const onGridNavigation = useCallback(
        (_ev: React.KeyboardEvent, focusNode: HTMLElement, state: RovingState): void => {
            if (getRow(state.activeNode) !== getRow(focusNode)) {
                focusNode.scrollIntoView({
                    behavior: "auto",
                    block: "center",
                    inline: "center",
                });
            }
        },
        [getRow],
    );

    const scrollToCategory = useCallback(
        (category: string): void => {
            scrollElement?.querySelector(`[data-category-id="${category}"]`)?.scrollIntoView();
        },
        [scrollElement],
    );

    const onChangeFilter = useCallback(
        (newFilter: string): void => {
            const lcFilter = newFilter.toLowerCase().trim(); // filter is case insensitive

            // User has typed a query, show highlight
            // If filter is cleared, hide highlight again
            if (lcFilter && !showHighlight) {
                setShowHighlight(true);
            } else if (!lcFilter && showHighlight) {
                setShowHighlight(false);
            }

            for (const cat of categories) {
                let emojis: IEmoji[];
                // If the new filter string includes the old filter string, we don't have to re-filter the whole dataset.
                if (lcFilter.includes(filter)) {
                    emojis = memoizedDataByCategory[cat.id];
                } else {
                    emojis = cat.id === "recent" ? recentlyUsed : DATA_BY_CATEGORY[cat.id];
                }

                emojis = filterEmojis(emojis, lcFilter);

                memoizedDataByCategory[cat.id] = emojis;
                cat.enabled = emojis.length > 0;
                // The setState below doesn't re-render the header and we already have the refs for updateVisibility, so...
                if (cat.ref.current) {
                    cat.ref.current.disabled = !cat.enabled;
                }
            }
            setFilter(newFilter);
            // Header underlines need to be updated, but updating requires knowing
            // where the categories are, so we wait for a tick.
            window.setTimeout(updateVisibility, 0);
        },
        [filter, showHighlight, categories, memoizedDataByCategory, recentlyUsed, updateVisibility],
    );

    const onEnterFilter = useCallback((): void => {
        // Only select emoji if highlight is shown
        if (!showHighlight) return;

        const btn = scrollElement?.querySelector<HTMLElement>('[role="gridcell"] [tabindex="0"]');
        btn?.click();
        onFinished();
    }, [showHighlight, scrollElement, onFinished]);

    const onHoverEmoji = useCallback((emoji: IEmoji): void => {
        setPreviewEmoji(emoji);
    }, []);

    const onHoverEmojiEnd = useCallback((): void => {
        setPreviewEmoji(undefined);
    }, []);

    const onClickEmoji = useCallback(
        (ev: ButtonEvent, emoji: IEmoji): void => {
            if (onChoose(emoji.unicode) !== false) {
                onRecordRecent?.(emoji.unicode);
            }
            if ((ev as React.KeyboardEvent).key === "Enter") {
                onFinished();
            }
        },
        [onChoose, onRecordRecent, onFinished],
    );

    return (
        <RovingGridIndexProvider
            getGridCell={getGridcell}
            getRow={getRow}
            getRovingNode={getRovingNode}
            handleInputFields
            moveFocus={shouldMoveFocus}
            onGridNavigation={onGridNavigation}
            onKeyDown={onKeyDown}
            getAction={getAction}
        >
            {({ onKeyDownHandler }) => (
                <section
                    className={classNames("mx_EmojiPicker", styles.picker)}
                    data-testid="mx_EmojiPicker"
                    onKeyDown={onKeyDownHandler}
                    aria-label={_t("a11y|emoji_picker")}
                >
                    <Header categories={categories} onAnchorClick={scrollToCategory} getAction={getAction} />
                    <Search
                        query={filter}
                        onChange={onChangeFilter}
                        onEnter={onEnterFilter}
                        onKeyDown={onKeyDownHandler}
                        inputRef={searchRef}
                    />
                    <AutoHideScrollbar
                        id="mx_EmojiPicker_body"
                        className={classNames("mx_EmojiPicker_body", styles.body, {
                            [styles.bodyShowHighlight]: showHighlight,
                        })}
                        wrappedRef={collectScrollElement}
                        onScroll={onScroll}
                    >
                        {categories.map((category) => (
                            <Category
                                key={category.id}
                                id={category.id}
                                name={category.name}
                                emojis={memoizedDataByCategory[category.id]}
                                scrollParent={scrollElement ?? undefined}
                                onClick={onClickEmoji}
                                onMouseEnter={onHoverEmoji}
                                onMouseLeave={onHoverEmojiEnd}
                                isEmojiDisabled={isEmojiDisabled}
                                selectedEmojis={selectedEmojis}
                            />
                        ))}
                    </AutoHideScrollbar>
                    {previewEmoji ? (
                        <Preview emoji={previewEmoji} />
                    ) : (
                        <QuickReactions onClick={onClickEmoji} selectedEmojis={selectedEmojis} getAction={getAction} />
                    )}
                </section>
            )}
        </RovingGridIndexProvider>
    );
}

export default EmojiPicker;
