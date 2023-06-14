/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";
import { defer, sleep } from "matrix-js-sdk/src/utils";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import dis from "./dispatcher/dispatcher";
import AsyncWrapper from "./AsyncWrapper";
import { Defaultize } from "./@types/common";

const DIALOG_CONTAINER_ID = "mx_Dialog_Container";
const STATIC_DIALOG_CONTAINER_ID = "mx_Dialog_StaticContainer";

// Type which accepts a React Component which looks like a Modal (accepts an onFinished prop)
export type ComponentType = React.ComponentType<{
    onFinished(...args: any): void;
}>;

// Generic type which returns the props of the Modal component with the onFinished being optional.
export type ComponentProps<C extends ComponentType> = Defaultize<
    Omit<React.ComponentProps<C>, "onFinished">,
    C["defaultProps"]
> &
    Partial<Pick<React.ComponentProps<C>, "onFinished">>;

export interface IModal<C extends ComponentType> {
    elem: React.ReactNode;
    className?: string;
    beforeClosePromise?: Promise<boolean>;
    closeReason?: string;
    onBeforeClose?(reason?: string): Promise<boolean>;
    onFinished: ComponentProps<C>["onFinished"];
    close(...args: Parameters<ComponentProps<C>["onFinished"]>): void;
    hidden?: boolean;
}

export interface IHandle<C extends ComponentType> {
    finished: Promise<Parameters<ComponentProps<C>["onFinished"]>>;
    close(...args: Parameters<ComponentProps<C>["onFinished"]>): void;
}

interface IOptions<C extends ComponentType> {
    onBeforeClose?: IModal<C>["onBeforeClose"];
}

export enum ModalManagerEvent {
    Opened = "opened",
}

type HandlerMap = {
    [ModalManagerEvent.Opened]: () => void;
};

export class ModalManager extends TypedEventEmitter<ModalManagerEvent, HandlerMap> {
    private counter = 0;
    // The modal to prioritise over all others. If this is set, only show
    // this modal. Remove all other modals from the stack when this modal
    // is closed.
    private priorityModal: IModal<any> | null = null;
    // The modal to keep open underneath other modals if possible. Useful
    // for cases like Settings where the modal should remain open while the
    // user is prompted for more information/errors.
    private staticModal: IModal<any> | null = null;
    // A list of the modals we have stacked up, with the most recent at [0]
    // Neither the static nor priority modal will be in this list.
    private modals: IModal<any>[] = [];

    private static getOrCreateContainer(): HTMLElement {
        let container = document.getElementById(DIALOG_CONTAINER_ID);

        if (!container) {
            container = document.createElement("div");
            container.id = DIALOG_CONTAINER_ID;
            document.body.appendChild(container);
        }

        return container;
    }

    private static getOrCreateStaticContainer(): HTMLElement {
        let container = document.getElementById(STATIC_DIALOG_CONTAINER_ID);

        if (!container) {
            container = document.createElement("div");
            container.id = STATIC_DIALOG_CONTAINER_ID;
            document.body.appendChild(container);
        }

        return container;
    }

    public toggleCurrentDialogVisibility(): void {
        const modal = this.getCurrentModal();
        if (!modal) return;
        modal.hidden = !modal.hidden;
    }

    public hasDialogs(): boolean {
        return !!this.priorityModal || !!this.staticModal || this.modals.length > 0;
    }

    public createDialog<C extends ComponentType>(
        Element: C,
        props?: ComponentProps<C>,
        className?: string,
        isPriorityModal = false,
        isStaticModal = false,
        options: IOptions<C> = {},
    ): IHandle<C> {
        return this.createDialogAsync<C>(
            Promise.resolve(Element),
            props,
            className,
            isPriorityModal,
            isStaticModal,
            options,
        );
    }

    public appendDialog<C extends ComponentType>(
        Element: C,
        props?: ComponentProps<C>,
        className?: string,
    ): IHandle<C> {
        return this.appendDialogAsync<C>(Promise.resolve(Element), props, className);
    }

    /**
     * @param reason either "backgroundClick" or undefined
     * @return whether a modal was closed
     */
    public closeCurrentModal(reason?: string): boolean {
        const modal = this.getCurrentModal();
        if (!modal) {
            return false;
        }
        modal.closeReason = reason;
        modal.close();
        return true;
    }

    private buildModal<C extends ComponentType>(
        prom: Promise<C>,
        props?: ComponentProps<C>,
        className?: string,
        options?: IOptions<C>,
    ): {
        modal: IModal<C>;
        closeDialog: IHandle<C>["close"];
        onFinishedProm: IHandle<C>["finished"];
    } {
        const modal = {
            onFinished: props?.onFinished,
            onBeforeClose: options?.onBeforeClose,
            className,

            // these will be set below but we need an object reference to pass to getCloseFn before we can do that
            elem: null,
        } as IModal<C>;

        // never call this from onFinished() otherwise it will loop
        const [closeDialog, onFinishedProm] = this.getCloseFn<C>(modal, props);

        // don't attempt to reuse the same AsyncWrapper for different dialogs,
        // otherwise we'll get confused.
        const modalCount = this.counter++;

        // FIXME: If a dialog uses getDefaultProps it clobbers the onFinished
        // property set here so you can't close the dialog from a button click!
        modal.elem = <AsyncWrapper key={modalCount} prom={prom} {...props} onFinished={closeDialog} />;
        modal.close = closeDialog;

        return { modal, closeDialog, onFinishedProm };
    }

    private getCloseFn<C extends ComponentType>(
        modal: IModal<C>,
        props?: ComponentProps<C>,
    ): [IHandle<C>["close"], IHandle<C>["finished"]] {
        const deferred = defer<Parameters<ComponentProps<C>["onFinished"]>>();
        return [
            async (...args: Parameters<ComponentProps<C>["onFinished"]>): Promise<void> => {
                if (modal.beforeClosePromise) {
                    await modal.beforeClosePromise;
                } else if (modal.onBeforeClose) {
                    modal.beforeClosePromise = modal.onBeforeClose(modal.closeReason);
                    const shouldClose = await modal.beforeClosePromise;
                    modal.beforeClosePromise = undefined;
                    if (!shouldClose) {
                        return;
                    }
                }
                deferred.resolve(args);
                if (props?.onFinished) props.onFinished.apply(null, args);
                const i = this.modals.indexOf(modal);
                if (i >= 0) {
                    this.modals.splice(i, 1);
                }

                if (this.priorityModal === modal) {
                    this.priorityModal = null;

                    // XXX: This is destructive
                    this.modals = [];
                }

                if (this.staticModal === modal) {
                    this.staticModal = null;

                    // XXX: This is destructive
                    this.modals = [];
                }

                this.reRender();
            },
            deferred.promise,
        ];
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
    public createDialogAsync<C extends ComponentType>(
        prom: Promise<C>,
        props?: ComponentProps<C>,
        className?: string,
        isPriorityModal = false,
        isStaticModal = false,
        options: IOptions<C> = {},
    ): IHandle<C> {
        const beforeModal = this.getCurrentModal();
        const { modal, closeDialog, onFinishedProm } = this.buildModal<C>(prom, props, className, options);
        if (isPriorityModal) {
            // XXX: This is destructive
            this.priorityModal = modal;
        } else if (isStaticModal) {
            // This is intentionally destructive
            this.staticModal = modal;
        } else {
            this.modals.unshift(modal);
        }

        this.reRender();
        this.emitIfChanged(beforeModal);

        return {
            close: closeDialog,
            finished: onFinishedProm,
        };
    }

    private appendDialogAsync<C extends ComponentType>(
        prom: Promise<C>,
        props?: ComponentProps<C>,
        className?: string,
    ): IHandle<C> {
        const beforeModal = this.getCurrentModal();
        const { modal, closeDialog, onFinishedProm } = this.buildModal<C>(prom, props, className, {});

        this.modals.push(modal);

        this.reRender();
        this.emitIfChanged(beforeModal);

        return {
            close: closeDialog,
            finished: onFinishedProm,
        };
    }

    private emitIfChanged(beforeModal?: IModal<any>): void {
        if (beforeModal !== this.getCurrentModal()) {
            this.emit(ModalManagerEvent.Opened);
        }
    }

    private onBackgroundClick = (): void => {
        const modal = this.getCurrentModal();
        if (!modal) {
            return;
        }
        // we want to pass a reason to the onBeforeClose
        // callback, but close is currently defined to
        // pass all number of arguments to the onFinished callback
        // so, pass the reason to close through a member variable
        modal.closeReason = "backgroundClick";
        modal.close();
        modal.closeReason = undefined;
    };

    private getCurrentModal(): IModal<any> {
        return this.priorityModal ? this.priorityModal : this.modals[0] || this.staticModal;
    }

    private async reRender(): Promise<void> {
        // TODO: We should figure out how to remove this weird sleep. It also makes testing harder
        //
        // await next tick because sometimes ReactDOM can race with itself and cause the modal to wrongly stick around
        await sleep(0);

        if (this.modals.length === 0 && !this.priorityModal && !this.staticModal) {
            // If there is no modal to render, make all of Element available
            // to screen reader users again
            dis.dispatch({
                action: "aria_unhide_main_app",
            });
            ReactDOM.unmountComponentAtNode(ModalManager.getOrCreateContainer());
            ReactDOM.unmountComponentAtNode(ModalManager.getOrCreateStaticContainer());
            return;
        }

        // Hide the content outside the modal to screen reader users
        // so they won't be able to navigate into it and act on it using
        // screen reader specific features
        dis.dispatch({
            action: "aria_hide_main_app",
        });

        if (this.staticModal) {
            const classes = classNames("mx_Dialog_wrapper mx_Dialog_staticWrapper", this.staticModal.className);

            const staticDialog = (
                <div className={classes}>
                    <div className="mx_Dialog">{this.staticModal.elem}</div>
                    <div
                        data-testid="dialog-background"
                        className="mx_Dialog_background mx_Dialog_staticBackground"
                        onClick={this.onBackgroundClick}
                    />
                </div>
            );

            ReactDOM.render(staticDialog, ModalManager.getOrCreateStaticContainer());
        } else {
            // This is safe to call repeatedly if we happen to do that
            ReactDOM.unmountComponentAtNode(ModalManager.getOrCreateStaticContainer());
        }

        const modal = this.getCurrentModal();
        if (modal !== this.staticModal && !modal.hidden) {
            const classes = classNames("mx_Dialog_wrapper", modal.className, {
                mx_Dialog_wrapperWithStaticUnder: this.staticModal,
            });

            const dialog = (
                <div className={classes}>
                    <div className="mx_Dialog">{modal.elem}</div>
                    <div
                        data-testid="dialog-background"
                        className="mx_Dialog_background"
                        onClick={this.onBackgroundClick}
                    />
                </div>
            );

            setImmediate(() => ReactDOM.render(dialog, ModalManager.getOrCreateContainer()));
        } else {
            // This is safe to call repeatedly if we happen to do that
            ReactDOM.unmountComponentAtNode(ModalManager.getOrCreateContainer());
        }
    }
}

if (!window.singletonModalManager) {
    window.singletonModalManager = new ModalManager();
}
export default window.singletonModalManager;
