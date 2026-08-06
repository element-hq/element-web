/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type Dispatch, useCallback, useId, useMemo, useRef, useState } from "react";
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
import { Tabs } from "./Tabs";
import { Search } from "./Search";
import { Preview } from "./Preview";
import { QuickReactions } from "./QuickReactions";
import { Emoji } from "./Emoji";
import { type ButtonEvent } from "./RovingButton";
import styles from "./EmojiPicker.module.css";

const ZERO_WIDTH_JOINER = "\u200D";

export const EMOJI_HEIGHT = 35;
export const EMOJIS_PER_ROW = 8;

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
const GridList: Components<ListItem>["List"] = ({ ref, ...props }) => {
    return <div {...props} ref={ref} className={styles.list} role="grid" aria-multiselectable />;
};

const GridItem: Components<ListItem>["Item"] = ({ item, ...props }) => {
    // Headers are interleaved with emoji rows as direct children of the role="grid"
    // list, so they must also be grid rows: a grid may only own rows/rowgroups.
    if (item.type === "header") {
        return <div {...props} role="row" />;
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

/** Convert recent emoji characters to emoji data, removing unknowns and duplicates */
function resolveRecentEmojis(recentEmojis: string[] | undefined): IEmoji[] {
    return Array.from(
        new Set((recentEmojis ?? []).map(getEmojiFromUnicode).filter((emoji): emoji is IEmoji => !!emoji)),
    );
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
 *
 * @param emojis - The emoji to filter
 * @param lcFilter - The lower-cased and trimmed filter string
 *
 * @returns The filtered and sorted emoji
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

    const recentlyUsed = useMemo(() => resolveRecentEmojis(recentEmojis), [recentEmojis]);

    const lcFilter = filter.toLowerCase().trim(); // filter is case insensitive

    // Compute emoji to show in each category and which categories are enabled
    // (ie. non-empty) from the recently used list and the filter.
    const { dataByCategory, enabledCategories } = useMemo(() => {
        const dataByCategory = {} as Record<CategoryKey, IEmoji[]>;
        const enabledCategories: CategoryKey[] = [];

        for (const cat of CATEGORY_CONFIG) {
            const emojis = filterEmojis(cat.id === "recent" ? recentlyUsed : DATA_BY_CATEGORY[cat.id], lcFilter);
            dataByCategory[cat.id] = emojis;
            if (emojis.length > 0) {
                enabledCategories.push(cat.id);
            }
        }

        return { dataByCategory, enabledCategories };
    }, [lcFilter, recentlyUsed]);

    const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(
        recentlyUsed.length > 0 ? "recent" : "people",
    );

    const collectScrollElement = useCallback((ref: HTMLDivElement | null): void => {
        setScrollElement(ref);
    }, []);

    // Flatten into a list for virtuoso.
    const items = useMemo<ListItem[]>(() => {
        const flat: ListItem[] = [];
        for (const cat of CATEGORY_CONFIG) {
            const emojis = dataByCategory[cat.id];
            if (emojis.length === 0) continue;
            flat.push({ type: "header", category: cat });
            for (let i = 0; i < emojis.length; i += EMOJIS_PER_ROW) {
                flat.push({ type: "row", emojis: emojis.slice(i, i + EMOJIS_PER_ROW), categoryId: cat.id });
            }
        }
        return flat;
    }, [dataByCategory]);

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
        // If the search field is active, the grid will still move the selected element but we don't
        // want it to change the focus because the user trying to type in the field.
        // NB. This does still break the ability to navigate the text field with left/right arrows
        // as they change the selected emoji in the grid. This seems… bad, but I'm keeping it how it was.
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

    const onChangeFilter = useCallback((newFilter: string): void => {
        setFilter(newFilter);
        // User has typed a query, show highlight.
        // If the filter is cleared, hide the highlight again.
        setShowHighlight(newFilter.trim() !== "");
    }, []);

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

    // Base for the IDs of the individual emoji cells: the search box points at the
    // active cell with aria-activedescendant, which requires the cells to have IDs.
    // It doesn't actually matter what the ID is, provided each is unique, because
    // the search box queries the roving context for the active element and gets its ID.
    // (generate a single unique ID and then suffix because hooks can't be called in
    // a loop).
    const emojiIdBase = useId();

    const renderItem = useCallback(
        (_index: number, item: ListItem): React.ReactNode => {
            if (item.type === "header") {
                const category = item.category;
                return (
                    <div className={styles.category} data-category-id={category.id} role="gridcell">
                        <Heading as="h2" className={styles.categoryLabel}>
                            {_t(category.untranslatedName)}
                        </Heading>
                    </div>
                );
            }
            return item.emojis.map((emoji) => (
                <div role="gridcell" className={styles.itemWrapper} key={emoji.hexcode}>
                    <Emoji
                        // The category is part of the ID because the same emoji can appear both in
                        // its own category and in the recently used one.
                        id={`${emojiIdBase}-${item.categoryId}-${emoji.hexcode}`}
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
        [selectedEmojis, onClickEmoji, onHoverEmoji, onHoverEmojiEnd, isEmojiDisabled, emojiIdBase],
    );

    const pickerBodyId = useId();

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
                    className={styles.picker}
                    onKeyDown={onKeyDownHandler}
                    aria-label={_t("emoji_picker|emoji_picker")}
                >
                    <Tabs
                        categories={CATEGORY_CONFIG}
                        enabledCategories={enabledCategories}
                        selectedCategory={selectedCategory}
                        onAnchorClick={scrollToCategory}
                        pickerBodyId={pickerBodyId}
                        getAction={getAction}
                    />
                    <Search
                        query={filter}
                        onChange={onChangeFilter}
                        onEnter={onEnterFilter}
                        onKeyDown={onKeyDownHandler}
                        inputRef={searchRef}
                        controlsId={pickerBodyId}
                    />
                    <AutoHideScrollbar
                        id={pickerBodyId}
                        className={classNames(styles.body, {
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
