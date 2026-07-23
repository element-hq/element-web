/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type RefObject } from "react";
import { type DATA_BY_CATEGORY, type Emoji as IEmoji } from "@matrix-org/emojibase-bindings";
import { Virtuoso, type Components } from "react-virtuoso";

import { EMOJI_HEIGHT, EMOJIS_PER_ROW } from "./config";
import Emoji from "./Emoji";
import { type ButtonEvent } from "./RovingButton";
import styles from "./EmojiPicker.module.css";
import { Heading } from "@vector-im/compound-web";

export type CategoryKey = keyof typeof DATA_BY_CATEGORY | "recent";

export interface ICategory {
    id: CategoryKey;
    name: string;
    // Emoji to show in the header for this category
    emoji: string;
    enabled: boolean;
    // Whether the category is currently visible
    visible: boolean;
    // Whether the category is the first visible category
    firstVisible: boolean;
    ref: RefObject<HTMLButtonElement | null>;
}

interface IProps {
    id: string;
    name: string;
    emojis: IEmoji[];
    selectedEmojis?: Set<string>;
    /**
     * The scroll container of the picker body, shared by all categories.
     * Rows are not rendered until it is known.
     */
    scrollParent?: HTMLElement;
    onClick(ev: ButtonEvent, emoji: IEmoji): void;
    onMouseEnter(emoji: IEmoji): void;
    onMouseLeave(emoji: IEmoji): void;
    isEmojiDisabled?: (unicode: string) => boolean;
}

function hexEncode(str: string): string {
    let hex: string;
    let i: number;

    let result = "";
    for (i = 0; i < str.length; i++) {
        hex = str.charCodeAt(i).toString(16);
        result += ("000" + hex).slice(-4);
    }

    return result;
}

// Stable component identities so Virtuoso does not remount its internals on re-render.
const GridList: Components<IEmoji[]>["List"] = React.forwardRef(function GridList(props, ref) {
    return <div {...props} ref={ref} className={styles.list} role="grid" aria-multiselectable />;
});

const GridRow: Components<IEmoji[]>["Item"] = ({ item: _item, ...props }) => <div {...props} role="row" />;

const gridComponents = { List: GridList, Item: GridRow };

class Category extends React.PureComponent<IProps> {
    private renderEmojiRow = (rowIndex: number, emojisForRow: IEmoji[]): JSX.Element => {
        const { onClick, onMouseEnter, onMouseLeave, selectedEmojis } = this.props;
        return (
            <React.Fragment>
                {emojisForRow.map((emoji) => (
                    <div
                        role="gridcell"
                        className={`mx_EmojiPicker_item_wrapper ${styles.itemWrapper}`}
                        key={emoji.hexcode}
                    >
                        <Emoji
                            emoji={emoji}
                            selectedEmojis={selectedEmojis}
                            onClick={onClick}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                            disabled={this.props.isEmojiDisabled?.(emoji.unicode)}
                            id={`mx_EmojiPicker_item_${this.props.id}_${hexEncode(emoji.unicode)}`}
                        />
                    </div>
                ))}
            </React.Fragment>
        );
    };

    public render(): React.ReactNode {
        const { emojis, name, scrollParent } = this.props;
        if (!emojis || emojis.length === 0) {
            return null;
        }

        const rows: IEmoji[][] = [];
        for (let i = 0; i < emojis.length; i += EMOJIS_PER_ROW) {
            rows.push(emojis.slice(i, i + EMOJIS_PER_ROW));
        }

        return (
            <section
                id={`mx_EmojiPicker_category_${this.props.id}`}
                className={styles.category}
                data-category-id={this.props.id}
                role="tabpanel"
                aria-label={name}
            >
                <Heading as="h2" className={styles.categoryLabel}>
                    {name}
                </Heading>
                {/* An out-of-view Virtuoso windowing against a shared scroll parent renders
                    nothing and reserves no space, so fix the height of the rows block
                    ourselves — it is deterministic thanks to fixedItemHeight. */}
                <div style={{ height: (rows.length + 1) * EMOJI_HEIGHT }}>
                    {scrollParent && (
                        <Virtuoso
                            customScrollParent={scrollParent}
                            data={rows}
                            fixedItemHeight={EMOJI_HEIGHT}
                            components={gridComponents}
                            itemContent={this.renderEmojiRow}
                        />
                    )}
                </div>
            </section>
        );
    }
}

export default Category;
