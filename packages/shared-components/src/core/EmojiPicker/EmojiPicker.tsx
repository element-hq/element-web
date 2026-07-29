/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type Dispatch, useCallback, useMemo, useRef, useState } from "react";
import { DATA_BY_CATEGORY, getEmojiFromUnicode, type Emoji as IEmoji } from "@matrix-org/emojibase-bindings";
import { type ListRange, Virtuoso, type Components, type VirtuosoHandle } from "react-virtuoso";
import { Heading } from "@vector-im/compound-web";
import classNames from "classnames";

import { _t, _td } from "../i18n/i18n";
import { AutoHideScrollbar } from "../utils/Scrollbar";
import {
    type IAction as RovingAction,
    type IState as RovingState,
    RovingGridIndexProvider,
    RovingStateActionType,
    type RovingTabIndexProviderProps,
} from "../roving";
import Tabs from "./Tabs";
import Search from "./Search";
import Preview from "./Preview";
import QuickReactions from "./QuickReactions";
import Emoji from "./Emoji";
import { EMOJI_HEIGHT, EMOJIS_PER_ROW } from "./config";
import { type ButtonEvent } from "./RovingButton";
import styles from "./EmojiPicker.module.css";

const ZERO_WIDTH_JOINER = "\u200D";

const CATEGORY_CONFIG: Category[] = [
    { id: "recent", untranslatedName: _td("emoji|category_frequently_used"), emoji: "🕒" },
    { id: "people", untranslatedName: _td("emoji|category_smileys_people"), emoji: "😀" },
    { id: "nature", untranslatedName: _td("emoji|category_animals_nature"), emoji: "🐕" },
    { id: "foods", untranslatedName: _td("emoji|category_food_drink"), emoji: "🍎" },
    { id: "activity", untranslatedName: _td("emoji|category_activities"), emoji: "⚽️" },
    { id: "places", untranslatedName: _td("emoji|category_travel_places"), emoji: "🚗" },
    { id: "objects", untranslatedName: _td("emoji|category_objects"), emoji: "💡" },
    { id: "symbols", untranslatedName: _td("emoji|category_symbols"), emoji: "⁉️" },
    { id: "flags", untranslatedName: _td("emoji|category_flags"), emoji: "🏁" },
];

export type CategoryKey = keyof typeof DATA_BY_CATEGORY | "recent";

export interface Category {
    id: CategoryKey;
    untranslatedName: TranslationKey;
    // Emoji to show in the header for this category
    emoji: string;
}

/**
 * A single entry in the flat virtual list: either a category header or a row of
 * emoji. Headers are interleaved with the rows so that they scroll inline with
 * the content rather than staying pinned to the top.
 */
type ListItem = { type: "header"; category: Category } | { type: "row"; emojis: IEmoji[]; categoryId: CategoryKey };

// Stable component identities so Virtuoso does not remount its internals on re-render.
// The single Virtuoso renders a flat list that mixes category headers and emoji rows.
// The Item wrapper picks its semantics per entry: a plain block for headers, a grid
// row for emoji rows.
const GridList: Components<ListItem>["List"] = React.forwardRef(function GridList(props, ref) {
    return <div {...props} ref={ref} className={styles.list} role="grid" aria-multiselectable />;
});

const GridItem: Components<ListItem>["Item"] = ({ item, ...props }) => {
    if (item.type === "header") {
        return <div {...props} />;
    }
    return <div {...props} role="row" className={styles.row} />;
};

const gridComponents = { List: GridList, Item: GridItem };

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
    // A list of recently used emoji, shown as the first category
    recentlyUsed: IEmoji[];
    memoizedDataByCategory: Record<CategoryKey, IEmoji[]>;
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

    return { recentlyUsed, memoizedDataByCategory };
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
    // The scroll container of the picker body, once mounted. The Virtuoso windows
    // its rows against this shared scroll parent.
    const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

    const searchRef = useRef<HTMLInputElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Created once from the initial props and mutated in place thereafter.
    const dataRef = useRef<EmojiPickerData | null>(null);
    if (dataRef.current === null) {
        dataRef.current = createEmojiPickerData(recentEmojis);
    }
    const { recentlyUsed, memoizedDataByCategory } = dataRef.current;

    const [enabledCategories, setEnabledCategories] = useState(() => {
        return CATEGORY_CONFIG.filter((c) => (recentlyUsed.length === 0 ? c.id !== "recent" : true)).map((c) => c.id);
    });

    const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(
        recentlyUsed.length > 0 ? "recent" : "people",
    );

    const collectScrollElement = useCallback((ref: HTMLDivElement | null): void => {
        setScrollElement(ref);
    }, []);

    // Flatten the (filtered) categories into a single list of headers and emoji rows
    // that drive the Virtuoso. Only categories that currently have matching emoji are
    // shown, and each category contributes one header followed by its rows. Recomputed
    // only when the filter changes (the data is mutated in place under a stable object
    // identity), so scrolling and hovering do not churn the list.
    const items = useMemo<ListItem[]>(() => {
        const flat: ListItem[] = [];
        for (const cat of CATEGORY_CONFIG) {
            const emojis = memoizedDataByCategory[cat.id];
            if (emojis.length === 0) continue;
            flat.push({ type: "header", category: cat });
            for (let i = 0; i < emojis.length; i += EMOJIS_PER_ROW) {
                flat.push({ type: "row", emojis: emojis.slice(i, i + EMOJIS_PER_ROW), categoryId: cat.id });
            }
        }
        return flat;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- memoizedDataByCategory is mutated in place; `filter` is the real trigger
    }, [filter, memoizedDataByCategory]);

    const onRangeChanged = useCallback(
        (range: ListRange): void => {
            // Collect the categories that own any item within the rendered range. Each
            // flat-list entry knows its category (headers directly, rows via categoryId),
            // so a category is visible whenever one of its entries is in range - including
            // when its header itself has scrolled out of view.
            const visibleCategoryIds = new Set<CategoryKey>();
            for (let i = range.startIndex; i <= range.endIndex; i++) {
                const item = items[i];
                if (!item) continue;
                visibleCategoryIds.add(item.type === "header" ? item.category.id : item.categoryId);
            }

            setSelectedCategory(CATEGORY_CONFIG.find((cat) => visibleCategoryIds.has(cat.id))?.id ?? "people");
        },
        [items],
    );

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
            // Find the flat index of the category's header and scroll it to the top.
            const index = items.findIndex((item) => item.type === "header" && item.category.id === category);
            if (index >= 0) {
                virtuosoRef.current?.scrollToIndex({ index, align: "start" });
            }
        },
        [items],
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

            const enabledCategories: CategoryKey[] = [];

            for (const cat of CATEGORY_CONFIG) {
                let emojis: IEmoji[];
                // If the new filter string includes the old filter string, we don't have to re-filter the whole dataset.
                if (lcFilter.includes(filter)) {
                    emojis = memoizedDataByCategory[cat.id];
                } else {
                    emojis = cat.id === "recent" ? recentlyUsed : DATA_BY_CATEGORY[cat.id];
                }

                emojis = filterEmojis(emojis, lcFilter);

                memoizedDataByCategory[cat.id] = emojis;

                if (emojis.length > 0) {
                    enabledCategories.push(cat.id);
                }
            }
            setFilter(newFilter);
            setEnabledCategories(enabledCategories);
            // Header underlines are refreshed by the effect that recomputes visibility
            // whenever the (filtered) item list changes.
        },
        [filter, showHighlight, memoizedDataByCategory, recentlyUsed],
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

    const renderItem = useCallback(
        (_index: number, item: ListItem): React.ReactNode => {
            if (item.type === "header") {
                const category = item.category;
                return (
                    <div
                        className={styles.category}
                        data-category-id={category.id}
                        id={`mx_EmojiPicker_category_${category.id}`}
                        role="tabpanel"
                        aria-label={_t(category.untranslatedName)}
                    >
                        <Heading as="h2" className={styles.categoryLabel}>
                            {_t(category.untranslatedName)}
                        </Heading>
                    </div>
                );
            }
            return item.emojis.map((emoji) => (
                <div
                    role="gridcell"
                    className={`mx_EmojiPicker_item_wrapper ${styles.itemWrapper}`}
                    key={emoji.hexcode}
                >
                    <Emoji
                        emoji={emoji}
                        selectedEmojis={selectedEmojis}
                        onClick={onClickEmoji}
                        onMouseEnter={onHoverEmoji}
                        onMouseLeave={onHoverEmojiEnd}
                        disabled={isEmojiDisabled?.(emoji.unicode)}
                    />
                </div>
            ));
        },
        [selectedEmojis, onClickEmoji, onHoverEmoji, onHoverEmojiEnd, isEmojiDisabled],
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
                    <Tabs
                        categories={CATEGORY_CONFIG}
                        enabledCategories={enabledCategories}
                        selectedCategory={selectedCategory}
                        onAnchorClick={scrollToCategory}
                        getAction={getAction}
                    />
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
                    >
                        {scrollElement && (
                            <Virtuoso
                                ref={virtuosoRef}
                                customScrollParent={scrollElement}
                                data={items}
                                defaultItemHeight={EMOJI_HEIGHT}
                                components={gridComponents}
                                itemContent={renderItem}
                                rangeChanged={onRangeChanged}
                            />
                        )}
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
