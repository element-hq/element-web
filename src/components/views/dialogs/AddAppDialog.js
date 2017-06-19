/*
Copyright 2016 OpenMarket Ltd

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
import sdk from '../../../index';
import AppIconTile from '../elements/AppIconTile';
import ModularWidgets from '../../structures/ModularWidgets';

/**
 * Prompt the user for address of iframe widget
 *
 * On success, `onFinished(true, newAppWidget)` is called.
 */
export default React.createClass({
    displayName: 'AddAppDialog',
    propTypes: {
        onFinished: React.PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            value: "",
        };
    },

    componentDidMount: function() {
        this.refs.input_value.select();
    },

    onValueChange: function(ev) {
        this.setState({ value: ev.target.value});
    },

    onFormSubmit: function(ev) {
        ev.preventDefault();
        this.props.onFinished(true, 'custom', this.state.value);
        return false;
    },

    onTileClick: function(value) {
        this.props.onFinished(true, value, null);
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const appCards = ModularWidgets.widgetTypes.map((widgetType, index) =>
            <AppIconTile
                key={index}
                type={widgetType.type}
                icon={widgetType.icon}
                name={widgetType.name}
                description={widgetType.description}
                onClick={this.onTileClick}/>,
            );

        return (
            <BaseDialog className="mx_AddAppDialog"
                onFinished={this.props.onFinished}
                title="Add an app Widget"
            >
                <div className="mx_Dialog_content">
                    {appCards}
                    <hr/>
                    <form className="mx_Custom_Widget_Form" onSubmit={this.onFormSubmit}>
                        <div>Or enter the URL of the widget to add.</div>
                        <input type="text" ref="input_value" value={this.state.value}
                            autoFocus={true} onChange={this.onValueChange} size="30"
                            className="mx_SetAppURLDialog_input"
                        />
                        <div className="mx_Dialog_buttons">
                            <input className="mx_Dialog_primary" type="submit" value="Add" />
                        </div>
                    </form>
                </div>
            </BaseDialog>
        );
    },
});
