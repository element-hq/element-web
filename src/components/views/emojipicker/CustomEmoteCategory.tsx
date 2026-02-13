import React, { type JSX } from "react";

import { CATEGORY_HEADER_HEIGHT, EMOJI_HEIGHT, EMOJIS_PER_ROW } from "./EmojiPicker";
import LazyRenderList from "../elements/LazyRenderList";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import { mediaFromMxc } from "../../../customisations/Media";
import { type ButtonEvent } from "../elements/AccessibleButton";

const OVERFLOW_ROWS = 3;

export interface CustomEmote {
    shortcode: string;
    url: string;
}

interface IProps {
    id: string;
    name: string;
    emotes: CustomEmote[];
    heightBefore: number;
    viewportHeight: number;
    scrollTop: number;
    onClick(ev: ButtonEvent, shortcode: string): void;
    onMouseEnter(shortcode: string, url: string): void;
    onMouseLeave(): void;
}

class CustomEmoteCategory extends React.PureComponent<IProps> {
    private renderEmoteRow = (rowIndex: number): JSX.Element => {
        const { onClick, onMouseEnter, onMouseLeave, emotes } = this.props;
        const emotesForRow = emotes.slice(rowIndex * EMOJIS_PER_ROW, (rowIndex + 1) * EMOJIS_PER_ROW);
        return (
            <div key={rowIndex} role="row">
                {emotesForRow.map((emote) => {
                    const httpUrl = mediaFromMxc(emote.url).getSquareThumbnailHttp(24);
                    return (
                        <div role="gridcell" className="mx_EmojiPicker_item_wrapper" key={emote.shortcode}>
                            <RovingAccessibleButton
                                id={`mx_EmojiPicker_item_${this.props.id}_${emote.shortcode}`}
                                onClick={(ev: ButtonEvent) => onClick(ev, emote.shortcode)}
                                onMouseEnter={() => onMouseEnter(emote.shortcode, emote.url)}
                                onMouseLeave={() => onMouseLeave()}
                                focusOnMouseOver
                            >
                                <div className="mx_EmojiPicker_item">
                                    <img
                                        src={httpUrl ?? undefined}
                                        alt={`:${emote.shortcode}:`}
                                        width={24}
                                        height={24}
                                        loading="lazy"
                                    />
                                </div>
                            </RovingAccessibleButton>
                        </div>
                    );
                })}
            </div>
        );
    };

    public render(): React.ReactNode {
        const { emotes, name, heightBefore, viewportHeight, scrollTop } = this.props;
        if (!emotes || emotes.length === 0) {
            return null;
        }
        const rows = new Array(Math.ceil(emotes.length / EMOJIS_PER_ROW));
        for (let counter = 0; counter < rows.length; ++counter) {
            rows[counter] = counter;
        }

        const viewportTop = scrollTop;
        const viewportBottom = viewportTop + viewportHeight;
        const listTop = heightBefore + CATEGORY_HEADER_HEIGHT;
        const listBottom = listTop + rows.length * EMOJI_HEIGHT;
        const top = Math.max(viewportTop, listTop);
        const bottom = Math.min(viewportBottom, listBottom);
        const localHeight = Math.max(0, bottom - top);
        const localScrollTop = Math.max(0, scrollTop - listTop);

        return (
            <section
                id={`mx_EmojiPicker_category_${this.props.id}`}
                className="mx_EmojiPicker_category"
                data-category-id={this.props.id}
                role="tabpanel"
                aria-label={name}
            >
                <h2 className="mx_EmojiPicker_category_label">{name}</h2>
                <LazyRenderList
                    className="mx_EmojiPicker_list"
                    itemHeight={EMOJI_HEIGHT}
                    items={rows}
                    scrollTop={localScrollTop}
                    height={localHeight}
                    overflowItems={OVERFLOW_ROWS}
                    overflowMargin={0}
                    renderItem={this.renderEmoteRow}
                    role="grid"
                />
            </section>
        );
    }
}

export default CustomEmoteCategory;
