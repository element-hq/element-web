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
import Modal from '../../../Modal';
import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import AppPermission from './AppPermission';
import AppWarning from './AppWarning';
import MessageSpinner from './MessageSpinner';
import WidgetUtils from '../../../WidgetUtils';

const ALLOWED_APP_URL_SCHEMES = ['https:', 'http:'];
const betaHelpMsg = 'This feature is currently experimental and is intended for beta testing only';

export default React.createClass({
    displayName: 'AppTile',

    propTypes: {
        id: React.PropTypes.string.isRequired,
        url: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        room: React.PropTypes.object.isRequired,
        type: React.PropTypes.string.isRequired,
        // Specifying 'fullWidth' as true will render the app tile to fill the width of the app drawer continer.
        // This should be set to true when there is only one widget in the app drawer, otherwise it should be false.
        fullWidth: React.PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            url: "",
        };
    },

    getInitialState: function() {
        const widgetPermissionId = [this.props.room.roomId, encodeURIComponent(this.props.url)].join('_');
        const hasPermissionToLoad = localStorage.getItem(widgetPermissionId);
        return {
            loading: false,
            widgetUrl: this.props.url,
            widgetPermissionId: widgetPermissionId,
            hasPermissionToLoad: Boolean(hasPermissionToLoad === 'true'),
            error: null,
            deleting: false,
        };
    },

    // Returns true if props.url is a scalar URL, typically https://scalar.vector.im/api
    isScalarUrl: function() {
        const scalarUrl = SdkConfig.get().integrations_rest_url;
        return scalarUrl && this.props.url.startsWith(scalarUrl);
    },

    isMixedContent: function() {
        const parentContentProtocol = window.location.protocol;
        const u = url.parse(this.props.url);
        const childContentProtocol = u.protocol;
        if (parentContentProtocol === 'https:' && childContentProtocol !== 'https:') {
            console.warn("Refusing to load mixed-content app:",
            parentContentProtocol, childContentProtocol, window.location, this.props.url);
            return true;
        }
        return false;
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
            this._scalarClient.scalarToken = token;
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

    _canUserModify: function() {
        return WidgetUtils.canUserModifyWidgets(this.props.room.roomId);
    },

    _onEditClick: function(e) {
        console.log("Edit widget ID ", this.props.id);
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        const src = this._scalarClient.getScalarInterfaceUrlForRoom(this.props.room.roomId, 'type_' + this.props.type);
        Modal.createDialog(IntegrationsManager, {
            src: src,
        }, "mx_IntegrationsManager");
    },

    /* If user has permission to modify widgets, delete the widget, otherwise revoke access for the widget to load in the user's browser
    */
    _onDeleteClick: function() {
        if (this._canUserModify()) {
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
        } else {
            console.log("Revoke widget permissions - %s", this.props.id);
            this._revokeWidgetPermission();
        }
    },

    // Widget labels to render, depending upon user permissions
    // These strings are translated at the point that they are inserted in to the DOM, in the render method
    _deleteWidgetLabel() {
        if (this._canUserModify()) {
            return 'Delete widget';
        }
        return 'Revoke widget access';
    },

    /* TODO -- Store permission in account data so that it is persisted across multiple devices */
    _grantWidgetPermission() {
        console.warn('Granting permission to load widget - ', this.state.widgetUrl);
        localStorage.setItem(this.state.widgetPermissionId, true);
        this.setState({hasPermissionToLoad: true});
    },

    _revokeWidgetPermission() {
        console.warn('Revoking permission to load widget - ', this.state.widgetUrl);
        localStorage.removeItem(this.state.widgetPermissionId);
        this.setState({hasPermissionToLoad: false});
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

        // Note that there is advice saying allow-scripts shouldn't be used with allow-same-origin
        // because that would allow the iframe to prgramatically remove the sandbox attribute, but
        // this would only be for content hosted on the same origin as the riot client: anything
        // hosted on the same origin as the client will get the same access as if you clicked
        // a link to it.
        const sandboxFlags = "allow-forms allow-popups allow-popups-to-escape-sandbox "+
            "allow-same-origin allow-scripts allow-presentation";
        const parsedWidgetUrl = url.parse(this.state.widgetUrl);
        let safeWidgetUrl = '';
        if (ALLOWED_APP_URL_SCHEMES.indexOf(parsedWidgetUrl.protocol) !== -1) {
            safeWidgetUrl = url.format(parsedWidgetUrl);
        }

        if (this.state.loading) {
            appTileBody = (
                <div className='mx_AppTileBody mx_AppLoading'>
                    <MessageSpinner msg='Loading...'/>
                </div>
            );
        } else if (this.state.hasPermissionToLoad == true) {
            if (this.isMixedContent()) {
                appTileBody = (
                    <div className="mx_AppTileBody">
                        <AppWarning
                            errorMsg="Error - Mixed content"
                        />
                    </div>
                );
            } else {
                appTileBody = (
                    <div className="mx_AppTileBody">
                        <iframe
                            ref="appFrame"
                            src={safeWidgetUrl}
                            allowFullScreen="true"
                            sandbox={sandboxFlags}
                        ></iframe>
                    </div>
                );
            }
        } else {
            appTileBody = (
                <div className="mx_AppTileBody">
                    <AppPermission
                        url={this.state.widgetUrl}
                        onPermissionGranted={this._grantWidgetPermission}
                    />
                </div>
            );
        }

        // editing is done in scalar
        const showEditButton = Boolean(this._scalarClient && this._canUserModify());
        const deleteWidgetLabel = this._deleteWidgetLabel();
        let deleteIcon = 'img/cancel.svg';
        let deleteClasses = 'mx_filterFlipColor mx_AppTileMenuBarWidget';
        if(this._canUserModify()) {
            deleteIcon = 'img/cancel-red.svg';
            deleteClasses += ' mx_AppTileMenuBarWidgetDelete';
        }

        return (
            <div className={this.props.fullWidth ? "mx_AppTileFullWidth" : "mx_AppTile"} id={this.props.id}>
                <div className="mx_AppTileMenuBar">
                    {this.formatAppTileName()}
                    <span className="mx_AppTileMenuBarWidgets">
                        <span className="mx_Beta" alt={betaHelpMsg} title={betaHelpMsg}>&#946;</span>
                        {/* Edit widget */}
                        {showEditButton && <img
                            src="img/edit.svg"
                            className="mx_filterFlipColor mx_AppTileMenuBarWidget mx_AppTileMenuBarWidgetPadding"
                            width="8" height="8"
                            alt={_t('Edit')}
                            title={_t('Edit')}
                            onClick={this._onEditClick}
                        />}

                        {/* Delete widget */}
                        <img src={deleteIcon}
                        className={deleteClasses}
                        width="8" height="8"
                        alt={_t(deleteWidgetLabel)}
                        title={_t(deleteWidgetLabel)}
                        onClick={this._onDeleteClick}
                        />
                    </span>
                </div>
                {appTileBody}
            </div>
        );
    },
});
