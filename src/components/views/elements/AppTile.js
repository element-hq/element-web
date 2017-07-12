/*
Copyright 2017 Vector Creations Ltd

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

'use strict';

import url from 'url';
import React from 'react';
import MatrixClientPeg from '../../../MatrixClientPeg';
import ScalarAuthClient from '../../../ScalarAuthClient';
import SdkConfig from '../../../SdkConfig';
import { _t } from '../../../languageHandler';

const ALLOWED_APP_URL_SCHEMES = ['https:', 'http:'];

export default React.createClass({
    displayName: 'AppTile',

    propTypes: {
        id: React.PropTypes.string.isRequired,
        url: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        room: React.PropTypes.object.isRequired,
    },

    getDefaultProps: function() {
        return {
            url: "",
        };
    },

    getInitialState: function() {
        return {
            loading: false,
            widgetUrl: this.props.url,
            error: null,
            deleting: false,
        };
    },

    // Returns true if props.url is a scalar URL, typically https://scalar.vector.im/api
    isScalarUrl: function() {
        const scalarUrl = SdkConfig.get().integrations_rest_url;
        return scalarUrl && this.props.url.startsWith(scalarUrl);
    },

    componentWillMount: function() {
        if (!this.isScalarUrl()) {
            return;
        }
        // Fetch the token before loading the iframe as we need to mangle the URL
        this.setState({
            loading: true,
        });
        this._scalarClient = new ScalarAuthClient();
        this._scalarClient.getScalarToken().done((token) => {
            // Append scalar_token as a query param
            const u = url.parse(this.props.url);
            if (!u.search) {
                u.search = "?scalar_token=" + encodeURIComponent(token);
            } else {
                u.search += "&scalar_token=" + encodeURIComponent(token);
            }

            this.setState({
                error: null,
                widgetUrl: u.format(),
                loading: false,
            });
        }, (err) => {
            this.setState({
                error: err.message,
                loading: false,
            });
        });
    },

    _onEditClick: function() {
        console.log("Edit widget %s", this.props.id);
    },

    _onDeleteClick: function() {
        console.log("Delete widget %s", this.props.id);
        this.setState({deleting: true});
        MatrixClientPeg.get().sendStateEvent(
            this.props.room.roomId,
            'im.vector.modular.widgets',
            {}, // empty content
            this.props.id,
        ).then(() => {
            console.log('Deleted widget');
        }, (e) => {
            console.error('Failed to delete widget', e);
            this.setState({deleting: false});
        });
    },

    formatAppTileName: function() {
        let appTileName = "No name";
        if(this.props.name && this.props.name.trim()) {
            appTileName = this.props.name.trim();
            appTileName = appTileName[0].toUpperCase() + appTileName.slice(1).toLowerCase();
        }
        return appTileName;
    },

    render: function() {
        let appTileBody;

        // Don't render widget if it is in the process of being deleted
        if (this.state.deleting) {
            return <div></div>;
        }

        if (this.state.loading) {
            appTileBody = (
                <div> Loading... </div>
            );
        } else {
            // Note that there is advice saying allow-scripts shouldn;t be used with allow-same-origin
            // because that would allow the iframe to prgramatically remove the sandbox attribute, but
            // this would only be for content hosted on the same origin as the riot client: anything
            // hosted on the same origin as the client will get the same access access as if you clicked
            // a link to it.
            const sandboxFlags = "allow-forms allow-popups allow-popups-to-escape-sandbox "+
                "allow-same-origin allow-scripts";
            const parsedWidgetUrl = url.parse(this.state.widgetUrl);
            let safeWidgetUrl = '';
            if (ALLOWED_APP_URL_SCHEMES.indexOf(parsedWidgetUrl.protocol) !== -1) {
                safeWidgetUrl = url.format(parsedWidgetUrl);
            }
            appTileBody = (
                <div className="mx_AppTileBody">
                    <iframe ref="appFrame" src={safeWidgetUrl} allowFullScreen="true"
                        sandbox={sandboxFlags}
                    ></iframe>
                </div>
            );
        }
        return (
            <div className={this.props.fullWidth ? "mx_AppTileFullWidth" : "mx_AppTile"} id={this.props.id}>
                <div className="mx_AppTileMenuBar">
                    {this.formatAppTileName()}
                    <span className="mx_AppTileMenuBarWidgets">
                        {/* Edit widget */}
                        {/* <img
                            src="img/edit.svg"
                            className="mx_filterFlipColor mx_AppTileMenuBarWidget mx_AppTileMenuBarWidgetPadding"
                            width="8" height="8" alt="Edit"
                            onClick={this._onEditClick}
                        /> */}

                        {/* Delete widget */}
                        <img src="img/cancel.svg"
                        className="mx_filterFlipColor mx_AppTileMenuBarWidget"
                        width="8" height="8" alt={_t("Cancel")}
                        onClick={this._onDeleteClick}
                        />
                    </span>
                </div>
                {appTileBody}
            </div>
        );
    },
});
