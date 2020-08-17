/*
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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
import createReactClass from 'create-react-class';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import AppTile from '../elements/AppTile';
import Modal from '../../../Modal';
import dis from '../../../dispatcher/dispatcher';
import * as sdk from '../../../index';
import * as ScalarMessaging from '../../../ScalarMessaging';
import { _t } from '../../../languageHandler';
import WidgetUtils from '../../../utils/WidgetUtils';
import WidgetEchoStore from "../../../stores/WidgetEchoStore";
import AccessibleButton from '../elements/AccessibleButton';
import {IntegrationManagers} from "../../../integrations/IntegrationManagers";
import SettingsStore from "../../../settings/SettingsStore";

// The maximum number of widgets that can be added in a room
const MAX_WIDGETS = 2;

export default createReactClass({
    displayName: 'AppsDrawer',

    propTypes: {
        userId: PropTypes.string.isRequired,
        room: PropTypes.object.isRequired,
        showApps: PropTypes.bool, // Should apps be rendered
        hide: PropTypes.bool, // If rendered, should apps drawer be visible
    },

    getDefaultProps: () => ({
        showApps: true,
        hide: false,
    }),

    getInitialState: function() {
        return {
            apps: this._getApps(),
        };
    },

    componentDidMount: function() {
        ScalarMessaging.startListening();
        MatrixClientPeg.get().on('RoomState.events', this.onRoomStateEvents);
        WidgetEchoStore.on('update', this._updateApps);
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        ScalarMessaging.stopListening();
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener('RoomState.events', this.onRoomStateEvents);
        }
        WidgetEchoStore.removeListener('update', this._updateApps);
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);
    },

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps(newProps) {
        // Room has changed probably, update apps
        this._updateApps();
    },

    onAction: function(action) {
        const hideWidgetKey = this.props.room.roomId + '_hide_widget_drawer';
        switch (action.action) {
            case 'appsDrawer':
                // Note: these booleans are awkward because localstorage is fundamentally
                // string-based. We also do exact equality on the strings later on.
                if (action.show) {
                    localStorage.setItem(hideWidgetKey, "false");
                } else {
                    // Store hidden state of widget
                    // Don't show if previously hidden
                    localStorage.setItem(hideWidgetKey, "true");
                }

                break;
        }
    },

    onRoomStateEvents: function(ev, state) {
        if (ev.getRoomId() !== this.props.room.roomId || ev.getType() !== 'im.vector.modular.widgets') {
            return;
        }
        this._updateApps();
    },

    _getApps: function() {
        const widgets = WidgetEchoStore.getEchoedRoomWidgets(
            this.props.room.roomId, WidgetUtils.getRoomWidgets(this.props.room),
        );
        return widgets.map((ev) => {
            return WidgetUtils.makeAppConfig(
                ev.getStateKey(), ev.getContent(), ev.getSender(), ev.getRoomId(), ev.getId(),
            );
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
        } catch (err) {
            console.error(err);
            return false;
        }
    },

    _launchManageIntegrations: function() {
        if (SettingsStore.getValue("feature_many_integration_managers")) {
            IntegrationManagers.sharedInstance().openAll();
        } else {
            IntegrationManagers.sharedInstance().getPrimaryManager().open(this.props.room, 'add_integ');
        }
    },

    onClickAddWidget: function(e) {
        e.preventDefault();
        // Display a warning dialog if the max number of widgets have already been added to the room
        const apps = this._getApps();
        if (apps && apps.length >= MAX_WIDGETS) {
            const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
            const errorMsg = `The maximum number of ${MAX_WIDGETS} widgets have already been added to this room.`;
            console.error(errorMsg);
            Modal.createDialog(ErrorDialog, {
                title: _t('Cannot add any more widgets'),
                description: _t('The maximum permitted number of widgets have already been added to this room.'),
            });
            return;
        }
        this._launchManageIntegrations();
    },

    render: function() {
        const apps = this.state.apps.map((app, index, arr) => {
            const capWhitelist = WidgetUtils.getCapWhitelistForAppTypeInRoomId(app.type, this.props.room.roomId);

            return (<AppTile
                key={app.id}
                app={app}
                fullWidth={arr.length<2 ? true : false}
                room={this.props.room}
                userId={this.props.userId}
                show={this.props.showApps}
                creatorUserId={app.creatorUserId}
                widgetPageTitle={(app.data && app.data.title) ? app.data.title : ''}
                waitForIframeLoad={app.waitForIframeLoad}
                whitelistCapabilities={capWhitelist}
            />);
        });

        if (apps.length == 0) {
            return <div></div>;
        }

        let addWidget;
        if (this.props.showApps &&
            this._canUserModify()
        ) {
            addWidget = <AccessibleButton
                onClick={this.onClickAddWidget}
                className={this.state.apps.length<2 ?
                    'mx_AddWidget_button mx_AddWidget_button_full_width' :
                    'mx_AddWidget_button'
                }
                title={_t('Add a widget')}>
                [+] { _t('Add a widget') }
            </AccessibleButton>;
        }

        let spinner;
        if (
            apps.length === 0 && WidgetEchoStore.roomHasPendingWidgets(
                this.props.room.roomId,
                WidgetUtils.getRoomWidgets(this.props.room),
            )
        ) {
            const Loader = sdk.getComponent("elements.Spinner");
            spinner = <Loader />;
        }

        return (
            <div className={'mx_AppsDrawer' + (this.props.hide ? ' mx_AppsDrawer_hidden' : '')}>
                <div id='apps' className='mx_AppsContainer'>
                    { apps }
                    { spinner }
                </div>
                { this._canUserModify() && addWidget }
            </div>
        );
    },
});
