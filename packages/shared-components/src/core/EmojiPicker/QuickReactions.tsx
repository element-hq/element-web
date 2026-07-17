/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { getEmojiFromUnicode, type Emoji as IEmoji } from "@matrix-org/emojibase-bindings";
import classNames from "classnames";

import { _t } from "../i18n/i18n";
import { Toolbar, type RovingTabIndexProviderProps } from "../roving";
import Emoji from "./Emoji";
import { type ButtonEvent } from "./RovingButton";
import styles from "./EmojiPicker.module.css";

// We use the variation-selector Heart in Quick Reactions for some reason
const QUICK_REACTIONS = ["👍", "👎", "😄", "🎉", "😕", "❤️", "🚀", "👀"].map((emoji) => {
    const data = getEmojiFromUnicode(emoji);
    if (!data) {
        throw new Error(`Emoji ${emoji} doesn't exist in emojibase`);
    }
    return data;
});

interface IProps {
    selectedEmojis?: Set<string>;
    onClick(ev: ButtonEvent, emoji: IEmoji): void;
    getAction?: RovingTabIndexProviderProps["getAction"];
}

interface IState {
    hover?: IEmoji;
}

class QuickReactions extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {};
    }

    private onMouseEnter = (emoji: IEmoji): void => {
        this.setState({
            hover: emoji,
        });
    };

    private onMouseLeave = (): void => {
        this.setState({
            hover: undefined,
        });
    };

    public render(): React.ReactNode {
        return (
            <section className={classNames(styles.footer, styles.quick, styles.category)}>
                <h2 className={classNames(styles.quickHeader, styles.categoryLabel)}>
                    {!this.state.hover ? (
                        _t("emoji|quick_reactions")
                    ) : (
                        <React.Fragment>
                            <span className={styles.name}>{this.state.hover.label}</span>
                            <span className={styles.shortcode}>{this.state.hover.shortcodes[0]}</span>
                        </React.Fragment>
                    )}
                </h2>
                <Toolbar
                    className={styles.list}
                    aria-label={_t("emoji|quick_reactions")}
                    getAction={this.props.getAction}
                >
                    {QUICK_REACTIONS.map((emoji) => (
                        <Emoji
                            key={emoji.hexcode}
                            emoji={emoji}
                            onClick={this.props.onClick}
                            onMouseEnter={this.onMouseEnter}
                            onMouseLeave={this.onMouseLeave}
                            selectedEmojis={this.props.selectedEmojis}
                            className={`mx_EmojiPicker_item_wrapper ${styles.itemWrapper}`}
                        />
                    ))}
                </Toolbar>
            </section>
        );
    }
}

export default QuickReactions;
