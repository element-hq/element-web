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

const React = require('react');
const ReactDOM = require('react-dom');
import PropTypes from 'prop-types';
import Analytics from './Analytics';
import sdk from './index';
import dis from './dispatcher';
import { _t } from './languageHandler';

const DIALOG_CONTAINER_ID = "mx_Dialog_Container";
const STATIC_DIALOG_CONTAINER_ID = "mx_Dialog_StaticContainer";

/**
 * Wrap an asynchronous loader function with a react component which shows a
 * spinner until the real component loads.
 */
const AsyncWrapper = React.createClass({
    propTypes: {
        /** A promise which resolves with the real component
         */
        prom: PropTypes.object.isRequired,
    },

    getInitialState: function() {
        return {
            component: null,
            error: null,
        };
    },

    componentWillMount: function() {
        this._unmounted = false;
        // XXX: temporary logging to try to diagnose
        // https://github.com/vector-im/riot-web/issues/3148
        console.log('Starting load of AsyncWrapper for modal');
        this.props.prom.then((result) => {
            if (this._unmounted) {
                return;
            }
            // Take the 'default' member if it's there, then we support
            // passing in just an import()ed module, since ES6 async import
            // always returns a module *namespace*.
            const component = result.default ? result.default : result;
            this.setState({component});
        }).catch((e) => {
            console.warn('AsyncWrapper promise failed', e);
            this.setState({error: e});
        });
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },

    _onWrapperCancelClick: function() {
        this.props.onFinished(false);
    },

    render: function() {
        const {loader, ...otherProps} = this.props;
        if (this.state.component) {
            const Component = this.state.component;
            return <Component {...otherProps} />;
        } else if (this.state.error) {
            const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
            const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
            return <BaseDialog onFinished={this.props.onFinished}
                title={_t("Error")}
            >
                {_t("Unable to load! Check your network connectivity and try again.")}
                <DialogButtons primaryButton={_t("Dismiss")}
                    onPrimaryButtonClick={this._onWrapperCancelClick}
                    hasCancel={false}
                />
            </BaseDialog>;
        } else {
            // show a spinner until the component is loaded.
            const Spinner = sdk.getComponent("elements.Spinner");
            return <Spinner />;
        }
    },
});

class ModalManager {
    constructor() {
        this._counter = 0;

        // The modal to prioritise over all others. If this is set, only show
        // this modal. Remove all other modals from the stack when this modal
        // is closed.
        this._priorityModal = null;
        // The modal to keep open underneath other modals if possible. Useful
        // for cases like Settings where the modal should remain open while the
        // user is prompted for more information/errors.
        this._staticModal = null;
        // A list of the modals we have stacked up, with the most recent at [0]
        // Neither the static nor priority modal will be in this list.
        this._modals = [
            /* {
               elem: React component for this dialog
               onFinished: caller-supplied onFinished callback
               className: CSS class for the dialog wrapper div
               } */
        ];

        this.closeAll = this.closeAll.bind(this);
    }

    getOrCreateContainer() {
        let container = document.getElementById(DIALOG_CONTAINER_ID);

        if (!container) {
            container = document.createElement("div");
            container.id = DIALOG_CONTAINER_ID;
            document.body.appendChild(container);
        }

        return container;
    }

    getOrCreateStaticContainer() {
        let container = document.getElementById(STATIC_DIALOG_CONTAINER_ID);

        if (!container) {
            container = document.createElement("div");
            container.id = STATIC_DIALOG_CONTAINER_ID;
            document.body.appendChild(container);
        }

        return container;
    }

    createTrackedDialog(analyticsAction, analyticsInfo, ...rest) {
        Analytics.trackEvent('Modal', analyticsAction, analyticsInfo);
        return this.createDialog(...rest);
    }

    createDialog(Element, ...rest) {
        return this.createDialogAsync(new Promise(resolve => resolve(Element)), ...rest);
    }

    createTrackedDialogAsync(analyticsAction, analyticsInfo, ...rest) {
        Analytics.trackEvent('Modal', analyticsAction, analyticsInfo);
        return this.createDialogAsync(...rest);
    }

    /**
     * Open a modal view.
     *
     * This can be used to display a react component which is loaded as an asynchronous
     * webpack component. To do this, set 'loader' as:
     *
     *   (cb) => {
     *       require(['<module>'], cb);
     *   }
     *
     * @param {Promise} prom   a promise which resolves with a React component
     *   which will be displayed as the modal view.
     *
     * @param {Object} props   properties to pass to the displayed
     *    component. (We will also pass an 'onFinished' property.)
     *
     * @param {String} className   CSS class to apply to the modal wrapper
     *
     * @param {boolean} isPriorityModal if true, this modal will be displayed regardless
     *                                  of other modals that are currently in the stack.
     *                                  Also, when closed, all modals will be removed
     *                                  from the stack.
     * @param {boolean} isStaticModal  if true, this modal will be displayed under other
     *                                 modals in the stack. When closed, all modals will
     *                                 also be removed from the stack. This is not compatible
     *                                 with being a priority modal. Only one modal can be
     *                                 static at a time.
     */
    createDialogAsync(prom, props, className, isPriorityModal, isStaticModal) {
        const self = this;
        const modal = {};

        // never call this from onFinished() otherwise it will loop
        //
        // nb explicit function() rather than arrow function, to get `arguments`
        const closeDialog = function() {
            if (props && props.onFinished) props.onFinished.apply(null, arguments);
            const i = self._modals.indexOf(modal);
            if (i >= 0) {
                self._modals.splice(i, 1);
            }

            if (self._priorityModal === modal) {
                self._priorityModal = null;

                // XXX: This is destructive
                self._modals = [];
            }

            if (self._staticModal === modal) {
                self._staticModal = null;

                // XXX: This is destructive
                self._modals = [];
            }

            self._reRender();
        };

        // don't attempt to reuse the same AsyncWrapper for different dialogs,
        // otherwise we'll get confused.
        const modalCount = this._counter++;

        // FIXME: If a dialog uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the dialog from a button click!
        modal.elem = (
            <AsyncWrapper key={modalCount} prom={prom} {...props}
                onFinished={closeDialog} />
        );
        modal.onFinished = props ? props.onFinished : null;
        modal.className = className;

        if (isPriorityModal) {
            // XXX: This is destructive
            this._priorityModal = modal;
        } else if (isStaticModal) {
            // This is intentionally destructive
            this._staticModal = modal;
        } else {
            this._modals.unshift(modal);
        }

        this._reRender();
        return {close: closeDialog};
    }

    closeAll() {
        const modalsToClose = [...this._modals, this._priorityModal];
        this._modals = [];
        this._priorityModal = null;

        if (this._staticModal && modalsToClose.length === 0) {
            modalsToClose.push(this._staticModal);
            this._staticModal = null;
        }

        for (let i = 0; i < modalsToClose.length; i++) {
            const m = modalsToClose[i];
            if (m && m.onFinished) {
                m.onFinished(false);
            }
        }

        this._reRender();
    }

    _reRender() {
        if (this._modals.length === 0 && !this._priorityModal && !this._staticModal) {
            // If there is no modal to render, make all of Riot available
            // to screen reader users again
            dis.dispatch({
                action: 'aria_unhide_main_app',
            });
            ReactDOM.unmountComponentAtNode(this.getOrCreateContainer());
            ReactDOM.unmountComponentAtNode(this.getOrCreateStaticContainer());
            return;
        }

        // Hide the content outside the modal to screen reader users
        // so they won't be able to navigate into it and act on it using
        // screen reader specific features
        dis.dispatch({
            action: 'aria_hide_main_app',
        });

        if (this._staticModal) {
            const classes = "mx_Dialog_wrapper mx_Dialog_staticWrapper "
                + (this._staticModal.className ? this._staticModal.className : '');

            const staticDialog = (
                <div className={classes}>
                    <div className="mx_Dialog">
                        { this._staticModal.elem }
                    </div>
                    <div className="mx_Dialog_background mx_Dialog_staticBackground" onClick={this.closeAll}></div>
                </div>
            );

            ReactDOM.render(staticDialog, this.getOrCreateStaticContainer());
        } else {
            // This is safe to call repeatedly if we happen to do that
            ReactDOM.unmountComponentAtNode(this.getOrCreateStaticContainer());
        }

        const modal = this._priorityModal ? this._priorityModal : this._modals[0];
        if (modal) {
            const classes = "mx_Dialog_wrapper "
                + (this._staticModal ? "mx_Dialog_wrapperWithStaticUnder " : '')
                + (modal.className ? modal.className : '');

            const dialog = (
                <div className={classes}>
                    <div className="mx_Dialog">
                        {modal.elem}
                    </div>
                    <div className="mx_Dialog_background" onClick={this.closeAll}></div>
                </div>
            );

            ReactDOM.render(dialog, this.getOrCreateContainer());
        } else {
            // This is safe to call repeatedly if we happen to do that
            ReactDOM.unmountComponentAtNode(this.getOrCreateContainer());
        }
    }
}

if (!global.singletonModalManager) {
    global.singletonModalManager = new ModalManager();
}
export default global.singletonModalManager;
