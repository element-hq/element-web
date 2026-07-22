/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { type CustomEmote } from "../../../custom-emotes";
import { type ButtonEvent } from "../elements/AccessibleButton";
import LazyRenderList from "../elements/LazyRenderList";
import { CATEGORY_HEADER_HEIGHT, EMOJI_HEIGHT, EMOJIS_PER_ROW } from "./config";
import CustomEmoteButton from "./CustomEmote";

const OVERFLOW_ROWS = 3;

interface IProps {
    emotes: CustomEmote[];
    heightBefore: number;
    viewportHeight: number;
    scrollTop: number;
    name: string;
    onClick(ev: ButtonEvent, emote: CustomEmote): void;
    onMouseEnter(emote: CustomEmote): void;
    onMouseLeave(emote: CustomEmote): void;
}

function packKey(emote: CustomEmote): string {
    return `${emote.pack.roomId}\u0000${emote.pack.stateKey}`;
}

export default class CustomEmoteCategory extends React.PureComponent<IProps> {
    private renderRow = (emotes: CustomEmote[], packIndex: number, rowIndex: number): React.ReactElement => {
        const start = rowIndex * EMOJIS_PER_ROW;
        return (
            <div role="row" key={rowIndex}>
                {emotes.slice(start, start + EMOJIS_PER_ROW).map((emote, columnIndex) => (
                    <div
                        role="gridcell"
                        className="mx_EmojiPicker_item_wrapper"
                        key={`${packKey(emote)}\u0000${emote.shortcode}`}
                    >
                        <CustomEmoteButton
                            id={`mx_EmojiPicker_item_custom_${packIndex}_${rowIndex}_${columnIndex}`}
                            emote={emote}
                            onClick={this.props.onClick}
                            onMouseEnter={this.props.onMouseEnter}
                            onMouseLeave={this.props.onMouseLeave}
                        />
                    </div>
                ))}
            </div>
        );
    };

    public render(): React.ReactNode {
        const groups = new Map<string, CustomEmote[]>();
        for (const emote of this.props.emotes) {
            const key = packKey(emote);
            groups.set(key, [...(groups.get(key) ?? []), emote]);
        }

        let packOffset = this.props.heightBefore + CATEGORY_HEADER_HEIGHT;
        return (
            <section
                id="mx_EmojiPicker_category_custom"
                className="mx_EmojiPicker_category mx_EmojiPicker_customCategory"
                data-category-id="custom"
                role="tabpanel"
                aria-label={this.props.name}
            >
                <h2 className="mx_EmojiPicker_category_label">{this.props.name}</h2>
                {[...groups.entries()].map(([key, emotes], packIndex) => {
                    const rows = Array.from({ length: Math.ceil(emotes.length / EMOJIS_PER_ROW) }, (_, index) => index);
                    const listTop = packOffset + CATEGORY_HEADER_HEIGHT;
                    const listBottom = listTop + rows.length * EMOJI_HEIGHT;
                    const viewportBottom = this.props.scrollTop + this.props.viewportHeight;
                    const localHeight = Math.max(
                        0,
                        Math.min(viewportBottom, listBottom) - Math.max(this.props.scrollTop, listTop),
                    );
                    const localScrollTop = Math.max(0, this.props.scrollTop - listTop);
                    packOffset = listBottom;

                    return (
                        <section className="mx_EmojiPicker_customPack" key={key}>
                            <h3 className="mx_EmojiPicker_customPack_label">{emotes[0].pack.displayName}</h3>
                            <div className="mx_EmojiPicker_list" role="grid" aria-label={emotes[0].pack.displayName}>
                                <LazyRenderList
                                    itemHeight={EMOJI_HEIGHT}
                                    items={rows}
                                    scrollTop={localScrollTop}
                                    height={localHeight}
                                    overflowItems={OVERFLOW_ROWS}
                                    overflowMargin={0}
                                    renderItem={(rowIndex) => this.renderRow(emotes, packIndex, rowIndex)}
                                />
                            </div>
                        </section>
                    );
                })}
            </section>
        );
    }
}
