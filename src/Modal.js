/*
Copyright 2015, 2016 OpenMarket Ltd

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
var ReactDOM = require('react-dom');

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

    createDialogWithElement: function(element, props, className) {
        var self = this;

        var closeDialog = function() {
            ReactDOM.unmountComponentAtNode(self.getOrCreateContainer());

            if (props && props.onFinished) props.onFinished.apply(null, arguments);
        };

        var dialog = (
            <div className={"mx_Dialog_wrapper " + className}>
                <div className="mx_Dialog">
                    {element}
                </div>
                <div className="mx_Dialog_background" onClick={closeDialog}></div>
            </div>
        );

        ReactDOM.render(dialog, this.getOrCreateContainer());

        return {close: closeDialog};
    },

    createDialog: function (Element, props, className) {
        var self = this;

        var closeDialog = function() {
            ReactDOM.unmountComponentAtNode(self.getOrCreateContainer());

            if (props && props.onFinished) props.onFinished.apply(null, arguments);
        };

        // FIXME: If a dialog uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the dialog from a button click!
        var dialog = (
            <div className={"mx_Dialog_wrapper " + className}>
                <div className="mx_Dialog">
                    <Element {...props} onFinished={closeDialog}/>
                </div>
                <div className="mx_Dialog_background" onClick={closeDialog}></div>
            </div>
        );

        ReactDOM.render(dialog, this.getOrCreateContainer());

        return {close: closeDialog};
    },
};
