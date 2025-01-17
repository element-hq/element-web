/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import Toolbar from "../../../accessibility/Toolbar";

export enum Formatting {
    Bold = "bold",
    Italics = "italics",
    Strikethrough = "strikethrough",
    Code = "code",
    Quote = "quote",
    InsertLink = "insert_link",
}

interface IProps {
    shortcuts: Partial<Record<Formatting, string>>;
    onAction(action: Formatting): void;
}

interface IState {
    visible: boolean;
}

export default class MessageComposerFormatBar extends React.PureComponent<IProps, IState> {
    private readonly formatBarRef = createRef<HTMLDivElement>();
    /**
     * The height of the format bar in pixels.
     * Height 32px + 2px border
     * @private
     */
    private readonly BAR_HEIGHT = 34;

    public constructor(props: IProps) {
        super(props);
        this.state = { visible: false };
    }

    public render(): React.ReactNode {
        const classes = classNames("mx_MessageComposerFormatBar", {
            mx_MessageComposerFormatBar_shown: this.state.visible,
        });
        return (
            <Toolbar className={classes} ref={this.formatBarRef} aria-label={_t("composer|formatting_toolbar_label")}>
                <FormatButton
                    label={_t("composer|format_bold")}
                    onClick={() => this.props.onAction(Formatting.Bold)}
                    icon="Bold"
                    shortcut={this.props.shortcuts.bold}
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("composer|format_italics")}
                    onClick={() => this.props.onAction(Formatting.Italics)}
                    icon="Italic"
                    shortcut={this.props.shortcuts.italics}
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("composer|format_strikethrough")}
                    onClick={() => this.props.onAction(Formatting.Strikethrough)}
                    icon="Strikethrough"
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("composer|format_code_block")}
                    onClick={() => this.props.onAction(Formatting.Code)}
                    icon="Code"
                    shortcut={this.props.shortcuts.code}
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("action|quote")}
                    onClick={() => this.props.onAction(Formatting.Quote)}
                    icon="Quote"
                    shortcut={this.props.shortcuts.quote}
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("composer|format_insert_link")}
                    onClick={() => this.props.onAction(Formatting.InsertLink)}
                    icon="InsertLink"
                    shortcut={this.props.shortcuts.insert_link}
                    visible={this.state.visible}
                />
            </Toolbar>
        );
    }

    public showAt(selectionRect: DOMRect): void {
        if (!this.formatBarRef.current?.parentElement) return;

        this.setState({ visible: true });
        const parentRect = this.formatBarRef.current.parentElement.getBoundingClientRect();
        this.formatBarRef.current.style.left = `${selectionRect.left - parentRect.left}px`;
        const halfBarHeight = this.BAR_HEIGHT / 2; // used to center the bar
        const offset = halfBarHeight + 2; // makes sure the bar won't cover selected text
        const offsetLimit = halfBarHeight + offset;
        const position = Math.max(selectionRect.top - parentRect.top - offsetLimit, -offsetLimit);
        this.formatBarRef.current.style.top = `${position}px`;
    }

    public hide(): void {
        this.setState({ visible: false });
    }
}

interface IFormatButtonProps {
    label: string;
    icon: string;
    shortcut?: string;
    visible?: boolean;
    onClick(): void;
}

class FormatButton extends React.PureComponent<IFormatButtonProps> {
    public render(): React.ReactNode {
        const className = `mx_MessageComposerFormatBar_button mx_MessageComposerFormatBar_buttonIcon${this.props.icon}`;

        // element="button" and type="button" are necessary for the buttons to work on WebKit,
        // otherwise the text is deselected before onClick can ever be called
        return (
            <RovingAccessibleButton
                element="button"
                type="button"
                onClick={this.props.onClick}
                aria-label={this.props.label}
                title={this.props.label}
                caption={this.props.shortcut}
                className={className}
            />
        );
    }
}
