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


import React from 'react';
import ReactDOM from 'react-dom';
import Analytics from './Analytics';
import dis from './dispatcher/dispatcher';
import {defer} from './utils/promise';
import AsyncWrapper from './AsyncWrapper';

const DIALOG_CONTAINER_ID = "mx_Dialog_Container";
const STATIC_DIALOG_CONTAINER_ID = "mx_Dialog_StaticContainer";

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

        this.onBackgroundClick = this.onBackgroundClick.bind(this);
    }

    hasDialogs() {
        return this._priorityModal || this._staticModal || this._modals.length > 0;
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

    appendTrackedDialog(analyticsAction, analyticsInfo, ...rest) {
        Analytics.trackEvent('Modal', analyticsAction, analyticsInfo);
        return this.appendDialog(...rest);
    }

    createDialog(Element, ...rest) {
        return this.createDialogAsync(Promise.resolve(Element), ...rest);
    }

    appendDialog(Element, ...rest) {
        return this.appendDialogAsync(Promise.resolve(Element), ...rest);
    }

    createTrackedDialogAsync(analyticsAction, analyticsInfo, ...rest) {
        Analytics.trackEvent('Modal', analyticsAction, analyticsInfo);
        return this.createDialogAsync(...rest);
    }

    appendTrackedDialogAsync(analyticsAction, analyticsInfo, ...rest) {
        Analytics.trackEvent('Modal', analyticsAction, analyticsInfo);
        return this.appendDialogAsync(...rest);
    }

    _buildModal(prom, props, className, options) {
        const modal = {};

        // never call this from onFinished() otherwise it will loop
        const [closeDialog, onFinishedProm] = this._getCloseFn(modal, props);

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
        modal.onBeforeClose = options.onBeforeClose;
        modal.beforeClosePromise = null;
        modal.close = closeDialog;
        modal.closeReason = null;

        return {modal, closeDialog, onFinishedProm};
    }

    _getCloseFn(modal, props) {
        const deferred = defer();
        return [async (...args) => {
            if (modal.beforeClosePromise) {
                await modal.beforeClosePromise;
            } else if (modal.onBeforeClose) {
                modal.beforeClosePromise = modal.onBeforeClose(modal.closeReason);
                const shouldClose = await modal.beforeClosePromise;
                modal.beforeClosePromise = null;
                if (!shouldClose) {
                    return;
                }
            }
            deferred.resolve(args);
            if (props && props.onFinished) props.onFinished.apply(null, args);
            const i = this._modals.indexOf(modal);
            if (i >= 0) {
                this._modals.splice(i, 1);
            }

            if (this._priorityModal === modal) {
                this._priorityModal = null;

                // XXX: This is destructive
                this._modals = [];
            }

            if (this._staticModal === modal) {
                this._staticModal = null;

                // XXX: This is destructive
                this._modals = [];
            }

            this._reRender();
        }, deferred.promise];
    }

    /**
     * @callback onBeforeClose
     * @param {string?} reason either "backgroundClick" or null
     * @return {Promise<bool>} whether the dialog should close
     */

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
     * @param {Object} options? extra options for the dialog
     * @param {onBeforeClose} options.onBeforeClose a callback to decide whether to close the dialog
     * @returns {object} Object with 'close' parameter being a function that will close the dialog
     */
    createDialogAsync(prom, props, className, isPriorityModal, isStaticModal, options = {}) {
        const {modal, closeDialog, onFinishedProm} = this._buildModal(prom, props, className, options);
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
        return {
            close: closeDialog,
            finished: onFinishedProm,
        };
    }

    appendDialogAsync(prom, props, className) {
        const {modal, closeDialog, onFinishedProm} = this._buildModal(prom, props, className, {});

        this._modals.push(modal);
        this._reRender();
        return {
            close: closeDialog,
            finished: onFinishedProm,
        };
    }

    onBackgroundClick() {
        const modal = this._getCurrentModal();
        if (!modal) {
            return;
        }
        // we want to pass a reason to the onBeforeClose
        // callback, but close is currently defined to
        // pass all number of arguments to the onFinished callback
        // so, pass the reason to close through a member variable
        modal.closeReason = "backgroundClick";
        modal.close();
        modal.closeReason = null;
    }

    _getCurrentModal() {
        return this._priorityModal ? this._priorityModal : (this._modals[0] || this._staticModal);
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
                    <div className="mx_Dialog_background mx_Dialog_staticBackground" onClick={this.onBackgroundClick}></div>
                </div>
            );

            ReactDOM.render(staticDialog, this.getOrCreateStaticContainer());
        } else {
            // This is safe to call repeatedly if we happen to do that
            ReactDOM.unmountComponentAtNode(this.getOrCreateStaticContainer());
        }

        const modal = this._getCurrentModal();
        if (modal !== this._staticModal) {
            const classes = "mx_Dialog_wrapper "
                + (this._staticModal ? "mx_Dialog_wrapperWithStaticUnder " : '')
                + (modal.className ? modal.className : '');

            const dialog = (
                <div className={classes}>
                    <div className="mx_Dialog">
                        {modal.elem}
                    </div>
                    <div className="mx_Dialog_background" onClick={this.onBackgroundClick}></div>
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
