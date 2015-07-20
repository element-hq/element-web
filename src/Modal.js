/*
Copyright 2015 OpenMarket Ltd

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

var React = require('react');
var q = require('q');

module.exports = {
    DialogContainerId: "mx_Dialog_Container",

    getOrCreateContainer: function() {
        var container = document.getElementById(this.DialogContainerId);

        if (!container) {
            container = document.createElement("div");
            container.id = this.DialogContainerId;
            document.body.appendChild(container);
        }

        return container;
    },

    createDialog: function (Element, props) {
        var self = this;

        var closeDialog = function() {
            React.unmountComponentAtNode(self.getOrCreateContainer());

            if (props && props.onFinished) props.onFinished.apply(arguments);
        };

        // FIXME: If a dialog uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the dialog from a button click!
        var dialog = (
            <div className="mx_Dialog_Wrapper">
                <div className="mx_Dialog">
                    <Element {...props} onFinished={closeDialog}/>
                </div>
                <div className="mx_Dialog_Background" onClick={closeDialog}></div>
            </div>
        );

        React.render(dialog, this.getOrCreateContainer());
    },
};
