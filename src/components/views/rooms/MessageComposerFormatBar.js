/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import classNames from 'classnames';
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";

export default class MessageComposerFormatBar extends React.PureComponent {
    static propTypes = {
        onAction: PropTypes.func.isRequired,
        shortcuts: PropTypes.object.isRequired,
    };

    constructor(props) {
        super(props);
        this.state = {visible: false};
    }

    render() {
        const classes = classNames("mx_MessageComposerFormatBar", {
            "mx_MessageComposerFormatBar_shown": this.state.visible,
        });
        return (<div className={classes} ref={ref => this._formatBarRef = ref}>
            <FormatButton label={_t("Bold")} onClick={() => this.props.onAction("bold")} icon="Bold" shortcut={this.props.shortcuts.bold} visible={this.state.visible} />
            <FormatButton label={_t("Italics")} onClick={() => this.props.onAction("italics")} icon="Italic" shortcut={this.props.shortcuts.italics} visible={this.state.visible} />
            <FormatButton label={_t("Strikethrough")} onClick={() => this.props.onAction("strikethrough")} icon="Strikethrough" visible={this.state.visible} />
            <FormatButton label={_t("Code block")} onClick={() => this.props.onAction("code")} icon="Code" visible={this.state.visible} />
            <FormatButton label={_t("Quote")} onClick={() => this.props.onAction("quote")} icon="Quote" shortcut={this.props.shortcuts.quote} visible={this.state.visible} />
        </div>);
    }

    showAt(selectionRect) {
        this.setState({visible: true});
        const parentRect = this._formatBarRef.parentElement.getBoundingClientRect();
        this._formatBarRef.style.left = `${selectionRect.left - parentRect.left}px`;
        // 12 is half the height of the bar (e.g. to center it) and 16 is an offset that felt ok.
        this._formatBarRef.style.top = `${selectionRect.top - parentRect.top - 16 - 12}px`;
    }

    hide() {
        this.setState({visible: false});
    }
}

class FormatButton extends React.PureComponent {
    static propTypes = {
        label: PropTypes.string.isRequired,
        onClick: PropTypes.func.isRequired,
        icon: PropTypes.string.isRequired,
        shortcut: PropTypes.string,
        visible: PropTypes.bool,
    };

    render() {
        const className = `mx_MessageComposerFormatBar_button mx_MessageComposerFormatBar_buttonIcon${this.props.icon}`;
        let shortcut;
        if (this.props.shortcut) {
            shortcut = <div className="mx_MessageComposerFormatBar_tooltipShortcut">{this.props.shortcut}</div>;
        }
        const tooltip = <div>
            <div className="mx_Tooltip_title">
                {this.props.label}
            </div>
            <div className="mx_Tooltip_sub">
                {shortcut}
            </div>
        </div>;

        return (
            <AccessibleTooltipButton
                as="span"
                role="button"
                onClick={this.props.onClick}
                title={this.props.label}
                tooltip={tooltip}
                className={className} />
        );
    }
}
