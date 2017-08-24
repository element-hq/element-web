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

import React from 'react';
import MatrixClientPeg from '../../../MatrixClientPeg';
import AppTile from '../elements/AppTile';
import Modal from '../../../Modal';
import dis from '../../../dispatcher';
import sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import ScalarAuthClient from '../../../ScalarAuthClient';
import ScalarMessaging from '../../../ScalarMessaging';
import { _t } from '../../../languageHandler';
import WidgetUtils from '../../../WidgetUtils';

// The maximum number of widgets that can be added in a room
const MAX_WIDGETS = 2;

module.exports = React.createClass({
    displayName: 'AppsDrawer',

    propTypes: {
        room: React.PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            apps: this._getApps(),
        };
    },

    componentWillMount: function() {
        ScalarMessaging.startListening();
        MatrixClientPeg.get().on("RoomState.events", this.onRoomStateEvents);
    },

    componentDidMount: function() {
        this.scalarClient = null;
        if (SdkConfig.get().integrations_ui_url && SdkConfig.get().integrations_rest_url) {
            this.scalarClient = new ScalarAuthClient();
            this.scalarClient.connect().then(() => {
                this.forceUpdate();
            }).catch((e) => {
                console.log("Failed to connect to integrations server");
                // TODO -- Handle Scalar errors
                //     this.setState({
                //         scalar_error: err,
                //     });
            });
        }

        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        ScalarMessaging.stopListening();
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.events", this.onRoomStateEvents);
        }
        dis.unregister(this.dispatcherRef);
    },

    componentWillReceiveProps(newProps) {
        // Room has changed probably, update apps
        this._updateApps();
    },

    onAction: function(action) {
        switch (action.action) {
            case 'appsDrawer':
                // When opening the app draw when there aren't any apps, auto-launch the
                // integrations manager to skip the awkward click on "Add widget"
                if (action.show) {
                    const apps = this._getApps();
                    if (apps.length === 0) {
                        this._launchManageIntegrations();
                    }
                }
                break;
        }
    },

    /**
     * Encodes a URI according to a set of template variables. Variables will be
     * passed through encodeURIComponent.
     * @param {string} pathTemplate The path with template variables e.g. '/foo/$bar'.
     * @param {Object} variables The key/value pairs to replace the template
     * variables with. E.g. { "$bar": "baz" }.
     * @return {string} The result of replacing all template variables e.g. '/foo/baz'.
     */
    encodeUri: function(pathTemplate, variables) {
        for (const key in variables) {
            if (!variables.hasOwnProperty(key)) {
                continue;
            }
            pathTemplate = pathTemplate.replace(
                key, encodeURIComponent(variables[key]),
            );
        }
        return pathTemplate;
    },

    _initAppConfig: function(appId, app, sender) {
        const user = MatrixClientPeg.get().getUser(this.props.userId);
        const params = {
            '$matrix_user_id': this.props.userId,
            '$matrix_room_id': this.props.room.roomId,
            '$matrix_display_name': user ? user.displayName : this.props.userId,
            '$matrix_avatar_url': user ? MatrixClientPeg.get().mxcUrlToHttp(user.avatarUrl) : '',
        };

        if(app.data) {
            Object.keys(app.data).forEach((key) => {
                params['$' + key] = app.data[key];
            });
        }

        app.id = appId;
        app.name = app.name || app.type;
        app.url = this.encodeUri(app.url, params);
        app.creatorUserId = (sender && sender.userId) ? sender.userId : null;

        return app;
    },

    onRoomStateEvents: function(ev, state) {
        if (ev.getRoomId() !== this.props.room.roomId || ev.getType() !== 'im.vector.modular.widgets') {
            return;
        }
        this._updateApps();
    },

    _getApps: function() {
        const appsStateEvents = this.props.room.currentState.getStateEvents('im.vector.modular.widgets');
        if (!appsStateEvents) {
            return [];
        }

        return appsStateEvents.filter((ev) => {
            return ev.getContent().type && ev.getContent().url;
        }).map((ev) => {
            return this._initAppConfig(ev.getStateKey(), ev.getContent(), ev.sender);
        });
    },

    _updateApps: function() {
        const apps = this._getApps();
        this.setState({
            apps: apps,
        });
    },

    _canUserModify: function() {
        try {
            return WidgetUtils.canUserModifyWidgets(this.props.room.roomId);
        } catch(err) {
            console.error(err);
            return false;
        }
    },

    _launchManageIntegrations: function() {
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        const src = (this.scalarClient !== null && this.scalarClient.hasCredentials()) ?
                this.scalarClient.getScalarInterfaceUrlForRoom(this.props.room.roomId, 'add_integ') :
                null;
        Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, {
            src: src,
        }, "mx_IntegrationsManager");
    },

    onClickAddWidget: function(e) {
        e.preventDefault();
        // Display a warning dialog if the max number of widgets have already been added to the room
        const apps = this._getApps();
        if (apps && apps.length >= MAX_WIDGETS) {
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            const errorMsg = `The maximum number of ${MAX_WIDGETS} widgets have already been added to this room.`;
            console.error(errorMsg);
            Modal.createDialog(ErrorDialog, {
                title: _t("Cannot add any more widgets"),
                description: _t("The maximum permitted number of widgets have already been added to this room."),
            });
            return;
        }
        this._launchManageIntegrations();
    },

    render: function() {
        const apps = this.state.apps.map(
            (app, index, arr) => {
                return (<AppTile
                    key={app.id}
                    id={app.id}
                    url={app.url}
                    name={app.name}
                    type={app.type}
                    fullWidth={arr.length<2 ? true : false}
                    room={this.props.room}
                    userId={this.props.userId}
                    show={this.props.showApps}
                    creatorUserId={app.creatorUserId}
                />);
            });

        let addWidget;
        if (this.props.showApps &&
            this._canUserModify()
        ) {
            addWidget = <div
                onClick={this.onClickAddWidget}
                role="button"
                tabIndex="0"
                className={this.state.apps.length<2 ?
                    "mx_AddWidget_button mx_AddWidget_button_full_width" :
                    "mx_AddWidget_button"
                }
                title={_t('Add a widget')}>
                [+] {_t('Add a widget')}
            </div>;
        }

        return (
            <div className="mx_AppsDrawer">
                <div id="apps" className="mx_AppsContainer">
                    {apps}
                </div>
                {this._canUserModify() && addWidget}
            </div>
        );
    },
});
