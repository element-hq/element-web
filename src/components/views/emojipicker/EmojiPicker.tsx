/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { Dispatch } from "react";

import { _t } from "../../../languageHandler";
import * as recent from "../../../emojipicker/recent";
import { DATA_BY_CATEGORY, getEmojiFromUnicode, IEmoji } from "../../../emoji";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import Header from "./Header";
import Search from "./Search";
import Preview from "./Preview";
import QuickReactions from "./QuickReactions";
import Category, { CategoryKey, ICategory } from "./Category";
import { filterBoolean } from "../../../utils/arrays";
import {
    IAction as RovingAction,
    IState as RovingState,
    RovingTabIndexProvider,
    Type,
} from "../../../accessibility/RovingTabIndex";
import { Key } from "../../../Keyboard";
import { clamp } from "../../../utils/numbers";
import { ButtonEvent } from "../elements/AccessibleButton";
import { Ref } from "../../../accessibility/roving/types";

export const CATEGORY_HEADER_HEIGHT = 20;
export const EMOJI_HEIGHT = 35;
export const EMOJIS_PER_ROW = 8;

const ZERO_WIDTH_JOINER = "\u200D";

interface IProps {
    selectedEmojis?: Set<string>;
    onChoose(unicode: string): boolean;
    onFinished(): void;
    isEmojiDisabled?: (unicode: string) => boolean;
}

interface IState {
    filter: string;
    previewEmoji?: IEmoji;
    scrollTop: number;
    // initial estimation of height, dialog is hardcoded to 450px height.
    // should be enough to never have blank rows of emojis as
    // 3 rows of overflow are also rendered. The actual value is updated on scroll.
    viewportHeight: number;
}

class EmojiPicker extends React.Component<IProps, IState> {
    private readonly recentlyUsed: IEmoji[];
    private readonly memoizedDataByCategory: Record<CategoryKey, IEmoji[]>;
    private readonly categories: ICategory[];

    private scrollRef = React.createRef<AutoHideScrollbar<"div">>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            filter: "",
            scrollTop: 0,
            viewportHeight: 280,
        };

        // Convert recent emoji characters to emoji data, removing unknowns and duplicates
        this.recentlyUsed = Array.from(new Set(filterBoolean(recent.get().map(getEmojiFromUnicode))));
        this.memoizedDataByCategory = {
            recent: this.recentlyUsed,
            ...DATA_BY_CATEGORY,
        };

        this.categories = [
            {
                id: "recent",
                name: _t("Frequently Used"),
                enabled: this.recentlyUsed.length > 0,
                visible: this.recentlyUsed.length > 0,
                ref: React.createRef(),
            },
            {
                id: "people",
                name: _t("Smileys & People"),
                enabled: true,
                visible: true,
                ref: React.createRef(),
            },
            {
                id: "nature",
                name: _t("Animals & Nature"),
                enabled: true,
                visible: false,
                ref: React.createRef(),
            },
            {
                id: "foods",
                name: _t("Food & Drink"),
                enabled: true,
                visible: false,
                ref: React.createRef(),
            },
            {
                id: "activity",
                name: _t("Activities"),
                enabled: true,
                visible: false,
                ref: React.createRef(),
            },
            {
                id: "places",
                name: _t("Travel & Places"),
                enabled: true,
                visible: false,
                ref: React.createRef(),
            },
            {
                id: "objects",
                name: _t("Objects"),
                enabled: true,
                visible: false,
                ref: React.createRef(),
            },
            {
                id: "symbols",
                name: _t("Symbols"),
                enabled: true,
                visible: false,
                ref: React.createRef(),
            },
            {
                id: "flags",
                name: _t("Flags"),
                enabled: true,
                visible: false,
                ref: React.createRef(),
            },
        ];
    }

    private onScroll = (): void => {
        const body = this.scrollRef.current?.containerRef.current;
        if (!body) return;
        this.setState({
            scrollTop: body.scrollTop,
            viewportHeight: body.clientHeight,
        });
        this.updateVisibility();
    };

    private keyboardNavigation(ev: React.KeyboardEvent, state: RovingState, dispatch: Dispatch<RovingAction>): void {
        const node = state.activeRef?.current;
        const parent = node?.parentElement;
        if (!parent || !state.activeRef) return;
        const rowIndex = Array.from(parent.children).indexOf(node);
        const refIndex = state.refs.indexOf(state.activeRef);

        let focusRef: Ref | undefined;
        let newParent: HTMLElement | undefined;
        switch (ev.key) {
            case Key.ARROW_LEFT:
                focusRef = state.refs[refIndex - 1];
                newParent = focusRef?.current?.parentElement ?? undefined;
                break;

            case Key.ARROW_RIGHT:
                focusRef = state.refs[refIndex + 1];
                newParent = focusRef?.current?.parentElement ?? undefined;
                break;

            case Key.ARROW_UP:
            case Key.ARROW_DOWN: {
                // For up/down we find the prev/next parent by inspecting the refs either side of our row
                const ref =
                    ev.key === Key.ARROW_UP
                        ? state.refs[refIndex - rowIndex - 1]
                        : state.refs[refIndex - rowIndex + EMOJIS_PER_ROW];
                newParent = ref?.current?.parentElement ?? undefined;
                const newTarget = newParent?.children[clamp(rowIndex, 0, newParent.children.length - 1)];
                focusRef = state.refs.find((r) => r.current === newTarget);
                break;
            }
        }

        if (focusRef) {
            dispatch({
                type: Type.SetFocus,
                payload: { ref: focusRef },
            });

            if (parent !== newParent) {
                focusRef.current?.scrollIntoView({
                    behavior: "auto",
                    block: "center",
                    inline: "center",
                });
            }
        }

        ev.preventDefault();
        ev.stopPropagation();
    }

    private onKeyDown = (ev: React.KeyboardEvent, state: RovingState, dispatch: Dispatch<RovingAction>): void => {
        if (
            state.activeRef?.current &&
            [Key.ARROW_DOWN, Key.ARROW_RIGHT, Key.ARROW_LEFT, Key.ARROW_UP].includes(ev.key)
        ) {
            this.keyboardNavigation(ev, state, dispatch);
        }
    };

    private updateVisibility = (): void => {
        const body = this.scrollRef.current?.containerRef.current;
        if (!body) return;
        const rect = body.getBoundingClientRect();
        for (const cat of this.categories) {
            const elem = body.querySelector(`[data-category-id="${cat.id}"]`);
            if (!elem) {
                cat.visible = false;
                cat.ref.current?.classList.remove("mx_EmojiPicker_anchor_visible");
                continue;
            }
            const elemRect = elem.getBoundingClientRect();
            const y = elemRect.y - rect.y;
            const yEnd = elemRect.y + elemRect.height - rect.y;
            cat.visible = y < rect.height && yEnd > 0;
            // We update this here instead of through React to avoid re-render on scroll.
            if (!cat.ref.current) continue;
            if (cat.visible) {
                cat.ref.current.classList.add("mx_EmojiPicker_anchor_visible");
                cat.ref.current.setAttribute("aria-selected", "true");
                cat.ref.current.setAttribute("tabindex", "0");
            } else {
                cat.ref.current.classList.remove("mx_EmojiPicker_anchor_visible");
                cat.ref.current.setAttribute("aria-selected", "false");
                cat.ref.current.setAttribute("tabindex", "-1");
            }
        }
    };

    private scrollToCategory = (category: string): void => {
        this.scrollRef.current?.containerRef.current
            ?.querySelector(`[data-category-id="${category}"]`)
            ?.scrollIntoView();
    };

    private onChangeFilter = (filter: string): void => {
        const lcFilter = filter.toLowerCase().trim(); // filter is case insensitive
        for (const cat of this.categories) {
            let emojis: IEmoji[];
            // If the new filter string includes the old filter string, we don't have to re-filter the whole dataset.
            if (lcFilter.includes(this.state.filter)) {
                emojis = this.memoizedDataByCategory[cat.id];
            } else {
                emojis = cat.id === "recent" ? this.recentlyUsed : DATA_BY_CATEGORY[cat.id];
            }

            if (lcFilter !== "") {
                emojis = emojis.filter((emoji) => this.emojiMatchesFilter(emoji, lcFilter));
                // Copy the array to not clobber the original unfiltered sorting
                emojis = [...emojis].sort((a, b) => {
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

            this.memoizedDataByCategory[cat.id] = emojis;
            cat.enabled = emojis.length > 0;
            // The setState below doesn't re-render the header and we already have the refs for updateVisibility, so...
            if (cat.ref.current) {
                cat.ref.current.disabled = !cat.enabled;
            }
        }
        this.setState({ filter });
        // Header underlines need to be updated, but updating requires knowing
        // where the categories are, so we wait for a tick.
        window.setTimeout(this.updateVisibility, 0);
    };

    private emojiMatchesFilter = (emoji: IEmoji, filter: string): boolean => {
        return (
            emoji.label.toLowerCase().includes(filter) ||
            (Array.isArray(emoji.emoticon)
                ? emoji.emoticon.some((x) => x.includes(filter))
                : emoji.emoticon?.includes(filter)) ||
            emoji.shortcodes.some((x) => x.toLowerCase().includes(filter)) ||
            emoji.unicode.split(ZERO_WIDTH_JOINER).includes(filter)
        );
    };

    private onEnterFilter = (): void => {
        const btn = this.scrollRef.current?.containerRef.current?.querySelector<HTMLButtonElement>(
            '.mx_EmojiPicker_item_wrapper[tabindex="0"]',
        );
        btn?.click();
        this.props.onFinished();
    };

    private onHoverEmoji = (emoji: IEmoji): void => {
        this.setState({
            previewEmoji: emoji,
        });
    };

    private onHoverEmojiEnd = (): void => {
        this.setState({
            previewEmoji: undefined,
        });
    };

    private onClickEmoji = (ev: ButtonEvent, emoji: IEmoji): void => {
        if (this.props.onChoose(emoji.unicode) !== false) {
            recent.add(emoji.unicode);
        }
        if ((ev as React.KeyboardEvent).key === Key.ENTER) {
            this.props.onFinished();
        }
    };

    private static categoryHeightForEmojiCount(count: number): number {
        if (count === 0) {
            return 0;
        }
        return CATEGORY_HEADER_HEIGHT + Math.ceil(count / EMOJIS_PER_ROW) * EMOJI_HEIGHT;
    }

    public render(): React.ReactNode {
        return (
            <RovingTabIndexProvider onKeyDown={this.onKeyDown}>
                {({ onKeyDownHandler }) => {
                    let heightBefore = 0;
                    return (
                        <div className="mx_EmojiPicker" data-testid="mx_EmojiPicker" onKeyDown={onKeyDownHandler}>
                            <Header categories={this.categories} onAnchorClick={this.scrollToCategory} />
                            <Search
                                query={this.state.filter}
                                onChange={this.onChangeFilter}
                                onEnter={this.onEnterFilter}
                                onKeyDown={onKeyDownHandler}
                            />
                            <AutoHideScrollbar
                                id="mx_EmojiPicker_body"
                                className="mx_EmojiPicker_body"
                                ref={this.scrollRef}
                                onScroll={this.onScroll}
                            >
                                {this.categories.map((category) => {
                                    const emojis = this.memoizedDataByCategory[category.id];
                                    const categoryElement = (
                                        <Category
                                            key={category.id}
                                            id={category.id}
                                            name={category.name}
                                            heightBefore={heightBefore}
                                            viewportHeight={this.state.viewportHeight}
                                            scrollTop={this.state.scrollTop}
                                            emojis={emojis}
                                            onClick={this.onClickEmoji}
                                            onMouseEnter={this.onHoverEmoji}
                                            onMouseLeave={this.onHoverEmojiEnd}
                                            isEmojiDisabled={this.props.isEmojiDisabled}
                                            selectedEmojis={this.props.selectedEmojis}
                                        />
                                    );
                                    const height = EmojiPicker.categoryHeightForEmojiCount(emojis.length);
                                    heightBefore += height;
                                    return categoryElement;
                                })}
                            </AutoHideScrollbar>
                            {this.state.previewEmoji ? (
                                <Preview emoji={this.state.previewEmoji} />
                            ) : (
                                <QuickReactions
                                    onClick={this.onClickEmoji}
                                    selectedEmojis={this.props.selectedEmojis}
                                />
                            )}
                        </div>
                    );
                }}
            </RovingTabIndexProvider>
        );
    }
}

export default EmojiPicker;
