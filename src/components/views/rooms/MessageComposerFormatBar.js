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
import sdk from '../../../index';


export default class MessageComposerFormatBar extends React.PureComponent {
    static propTypes = {
        onAction: PropTypes.func.isRequired,
    }

    render() {
        return (<div className="mx_MessageComposerFormatBar" ref={ref => this._formatBarRef = ref}>
            <FormatButton label={_t("Bold")} onClick={() => this.props.onAction("bold")} icon="Bold" />
            <FormatButton label={_t("Italics")} onClick={() => this.props.onAction("italics")} icon="Italic" />
            <FormatButton label={_t("Strikethrough")} onClick={() => this.props.onAction("strikethrough")} icon="Strikethrough" />
            <FormatButton label={_t("Code block")} onClick={() => this.props.onAction("code")} icon="Code" />
            <FormatButton label={_t("Quote")} onClick={() => this.props.onAction("quote")} icon="Quote" />
        </div>);
    }

    showAt(selectionRect) {
        this._formatBarRef.classList.add("mx_MessageComposerFormatBar_shown");
        let leftOffset = 0;
        let node = this._formatBarRef;
        while (node.offsetParent) {
            node = node.offsetParent;
            leftOffset += node.offsetLeft;
        }

        let topOffset = 0;
        node = this._formatBarRef;
        while (node.offsetParent) {
            node = node.offsetParent;
            topOffset += node.offsetTop;
        }

        this._formatBarRef.style.left = `${selectionRect.left - leftOffset}px`;
        // 12 is half the height of the bar (e.g. to center it) and 16 is an offset that felt ok.
        this._formatBarRef.style.top = `${selectionRect.top - topOffset - 16 - 12}px`;
    }

    hide() {
        this._formatBarRef.classList.remove("mx_MessageComposerFormatBar_shown");
    }
}

class FormatButton extends React.PureComponent {
    static propTypes = {
        label: PropTypes.string.isRequired,
        onClick: PropTypes.func.isRequired,
        icon: PropTypes.string.isRequired,
    }

    render() {
        const InteractiveTooltip = sdk.getComponent('elements.InteractiveTooltip');
        const className = `mx_MessageComposerFormatBar_button mx_MessageComposerFormatBar_buttonIcon${this.props.icon}`;
        const tooltipContent = (
            <div className="mx_MessageComposerFormatBar_buttonTooltip">{this.props.label}</div>
        );

        return (
            <InteractiveTooltip content={tooltipContent}>
                <span aria-label={this.props.label}
                   role="button"
                   onClick={this.props.onClick}
                   className={className}>
                </span>
            </InteractiveTooltip>
        );
    }
}
