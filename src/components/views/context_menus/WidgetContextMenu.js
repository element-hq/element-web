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
import {_t} from '../../../languageHandler';
import {MenuItem} from "../../structures/ContextMenu";

export default class WidgetContextMenu extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func,

        // Callback for when the revoke button is clicked. Required.
        onRevokeClicked: PropTypes.func.isRequired,

        // Callback for when the unpin button is clicked. If absent, unpin will be hidden.
        onUnpinClicked: PropTypes.func,

        // Callback for when the snapshot button is clicked. Button not shown
        // without a callback.
        onSnapshotClicked: PropTypes.func,

        // Callback for when the reload button is clicked. Button not shown
        // without a callback.
        onReloadClicked: PropTypes.func,

        // Callback for when the edit button is clicked. Button not shown
        // without a callback.
        onEditClicked: PropTypes.func,

        // Callback for when the delete button is clicked. Button not shown
        // without a callback.
        onDeleteClicked: PropTypes.func,
    };

    proxyClick(fn) {
        fn();
        if (this.props.onFinished) this.props.onFinished();
    }

    // XXX: It's annoying that our context menus require us to hit onFinished() to close :(

    onEditClicked = () => {
        this.proxyClick(this.props.onEditClicked);
    };

    onReloadClicked = () => {
        this.proxyClick(this.props.onReloadClicked);
    };

    onSnapshotClicked = () => {
        this.proxyClick(this.props.onSnapshotClicked);
    };

    onDeleteClicked = () => {
        this.proxyClick(this.props.onDeleteClicked);
    };

    onRevokeClicked = () => {
        this.proxyClick(this.props.onRevokeClicked);
    };

    onUnpinClicked = () => this.proxyClick(this.props.onUnpinClicked);

    render() {
        const options = [];

        if (this.props.onEditClicked) {
            options.push(
                <MenuItem className='mx_WidgetContextMenu_option' onClick={this.onEditClicked} key='edit'>
                    {_t("Edit")}
                </MenuItem>,
            );
        }

        if (this.props.onUnpinClicked) {
            options.push(
                <MenuItem className="mx_WidgetContextMenu_option" onClick={this.onUnpinClicked} key="unpin">
                    {_t("Unpin")}
                </MenuItem>,
            );
        }

        if (this.props.onReloadClicked) {
            options.push(
                <MenuItem className='mx_WidgetContextMenu_option' onClick={this.onReloadClicked} key='reload'>
                    {_t("Reload")}
                </MenuItem>,
            );
        }

        if (this.props.onSnapshotClicked) {
            options.push(
                <MenuItem className='mx_WidgetContextMenu_option' onClick={this.onSnapshotClicked} key='snap'>
                    {_t("Take picture")}
                </MenuItem>,
            );
        }

        if (this.props.onDeleteClicked) {
            options.push(
                <MenuItem className='mx_WidgetContextMenu_option' onClick={this.onDeleteClicked} key='delete'>
                    {_t("Remove for everyone")}
                </MenuItem>,
            );
        }

        // Push this last so it appears last. It's always present.
        options.push(
            <MenuItem className='mx_WidgetContextMenu_option' onClick={this.onRevokeClicked} key='revoke'>
                {_t("Remove for me")}
            </MenuItem>,
        );

        // Put separators between the options
        if (options.length > 1) {
            const length = options.length;
            for (let i = 0; i < length - 1; i++) {
                const sep = <hr key={i} className="mx_WidgetContextMenu_separator" />;

                // Insert backwards so the insertions don't affect our math on where to place them.
                // We also use our cached length to avoid worrying about options.length changing
                options.splice(length - 1 - i, 0, sep);
            }
        }

        return <div className="mx_WidgetContextMenu">{options}</div>;
    }
}
