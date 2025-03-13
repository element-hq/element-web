/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import classNames from "classnames";
import { type IDeferred, defer } from "matrix-js-sdk/src/utils";
import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";
import { Glass, TooltipProvider } from "@vector-im/compound-web";

import defaultDispatcher from "./dispatcher/dispatcher";
import AsyncWrapper from "./AsyncWrapper";
import { type Defaultize } from "./@types/common";
import { type ActionPayload } from "./dispatcher/payloads";

const DIALOG_CONTAINER_ID = "mx_Dialog_Container";
const STATIC_DIALOG_CONTAINER_ID = "mx_Dialog_StaticContainer";

// Type which accepts a React Component which looks like a Modal (accepts an onFinished prop)
export type ComponentType =
    | React.ComponentType<{
          onFinished(...args: any): void;
      }>
    | React.ComponentType<any>;

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
    closeReason?: ModalCloseReason;
    onBeforeClose?(reason?: ModalCloseReason): Promise<boolean>;
    onFinished: ComponentProps<C>["onFinished"];
    close(...args: Parameters<ComponentProps<C>["onFinished"]>): void;
    hidden?: boolean;
    deferred?: IDeferred<Parameters<ComponentProps<C>["onFinished"]>>;
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
    Closed = "closed",
}

type HandlerMap = {
    [ModalManagerEvent.Opened]: () => void;
    [ModalManagerEvent.Closed]: () => void;
};

type ModalCloseReason = "backgroundClick";

function getOrCreateContainer(id: string): HTMLDivElement {
    let container = document.getElementById(id) as HTMLDivElement | null;
    if (!container) {
        container = document.createElement("div");
        container.id = id;
        document.body.appendChild(container);
    }
    return container;
}

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

    private static root?: Root;
    private static getOrCreateRoot(): Root {
        if (!ModalManager.root) {
            const container = getOrCreateContainer(DIALOG_CONTAINER_ID);
            ModalManager.root = createRoot(container);
        }
        return ModalManager.root;
    }

    private static staticRoot?: Root;
    private static getOrCreateStaticRoot(): Root {
        if (!ModalManager.staticRoot) {
            const container = getOrCreateContainer(STATIC_DIALOG_CONTAINER_ID);
            ModalManager.staticRoot = createRoot(container);
        }
        return ModalManager.staticRoot;
    }

    public constructor() {
        super();

        // We never unregister this, but the Modal class is a singleton so there would
        // never be an opportunity to do so anyway, except in the entirely theoretical
        // scenario of instantiating a non-singleton instance of the Modal class.
        defaultDispatcher.register(this.onAction);
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === "logout") {
            this.forceCloseAllModals();
        }
    };

    public toggleCurrentDialogVisibility(): void {
        const modal = this.getCurrentModal();
        if (!modal) return;
        modal.hidden = !modal.hidden;
    }

    public hasDialogs(): boolean {
        return !!this.priorityModal || !!this.staticModal || this.modals.length > 0;
    }

    /**
     * DEPRECATED.
     * This is used only for tests. They should be using forceCloseAllModals but that
     * caused a chunk of tests to fail, so for now they continue to use this.
     *
     * @param reason either "backgroundClick" or undefined
     * @return whether a modal was closed
     */
    public closeCurrentModal(reason?: ModalCloseReason): boolean {
        const modal = this.getCurrentModal();
        if (!modal) {
            return false;
        }
        modal.closeReason = reason;
        modal.close();
        return true;
    }

    /**
     * Forces closes all open modals. The modals onBeforeClose function will not be
     * run and the modal will not have a chance to prevent closing. Intended for
     * situations like the user logging out of the app.
     */
    public forceCloseAllModals(): void {
        for (const modal of this.modals) {
            modal.deferred?.resolve([]);
            if (modal.onFinished) modal.onFinished.apply(null);
            this.emitClosed();
        }

        this.modals = [];
        this.reRender();
    }

    /**
     * @typeParam C - the component type
     */
    private buildModal<C extends ComponentType>(
        Component: C,
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

        // Typescript doesn't like us passing props as any here, but we know that they are well typed due to the rigorous generics.
        modal.elem = (
            <AsyncWrapper key={modalCount} onFinished={closeDialog}>
                <Component {...(props as any)} onFinished={closeDialog} />
            </AsyncWrapper>
        );
        modal.close = closeDialog;

        return { modal, closeDialog, onFinishedProm };
    }

    private getCloseFn<C extends ComponentType>(
        modal: IModal<C>,
        props?: ComponentProps<C>,
    ): [IHandle<C>["close"], IHandle<C>["finished"]] {
        modal.deferred = defer<Parameters<ComponentProps<C>["onFinished"]>>();
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
                modal.deferred?.resolve(args);
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
                this.emitClosed();
            },
            modal.deferred.promise,
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
     * @param component The component to render as a dialog. This component must accept an `onFinished` prop function as
     *                  per the type {@link ComponentType}. If loading a component with esoteric dependencies consider
     *                  using React.lazy to async load the component.
     *                  e.g. `lazy(() => import('./MyComponent'))`
     *
     * @param props properties to pass to the displayed component. (We will also pass an 'onFinished' property.)
     *
     * @param className CSS class to apply to the modal wrapper
     *
     * @param isPriorityModal if true, this modal will be displayed regardless
     *                                  of other modals that are currently in the stack.
     *                                  Also, when closed, all modals will be removed
     *                                  from the stack.
     * @param isStaticModal if true, this modal will be displayed under other
     *                                 modals in the stack. When closed, all modals will
     *                                 also be removed from the stack. This is not compatible
     *                                 with being a priority modal. Only one modal can be
     *                                 static at a time.
     * @param options? extra options for the dialog
     * @param options.onBeforeClose a callback to decide whether to close the dialog
     * @returns Object with 'close' parameter being a function that will close the dialog
     */
    public createDialog<C extends ComponentType>(
        component: C,
        props?: ComponentProps<C>,
        className?: string,
        isPriorityModal = false,
        isStaticModal = false,
        options: IOptions<C> = {},
    ): IHandle<C> {
        const beforeModal = this.getCurrentModal();
        const { modal, closeDialog, onFinishedProm } = this.buildModal<C>(component, props, className, options);
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

    public appendDialog<C extends ComponentType>(
        component: C,
        props?: ComponentProps<C>,
        className?: string,
    ): IHandle<C> {
        const beforeModal = this.getCurrentModal();
        const { modal, closeDialog, onFinishedProm } = this.buildModal<C>(component, props, className, {});

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

    /**
     * Emit the closed event
     * @private
     */
    private emitClosed(): void {
        this.emit(ModalManagerEvent.Closed);
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
        if (this.modals.length === 0 && !this.priorityModal && !this.staticModal) {
            // If there is no modal to render, make all of Element available
            // to screen reader users again
            defaultDispatcher.dispatch({
                action: "aria_unhide_main_app",
            });
            ModalManager.getOrCreateRoot().render(<></>);
            ModalManager.getOrCreateStaticRoot().render(<></>);
            return;
        }

        // Hide the content outside the modal to screen reader users
        // so they won't be able to navigate into it and act on it using
        // screen reader specific features
        defaultDispatcher.dispatch({
            action: "aria_hide_main_app",
        });

        if (this.staticModal) {
            const classes = classNames("mx_Dialog_wrapper mx_Dialog_staticWrapper", this.staticModal.className);

            const staticDialog = (
                <StrictMode>
                    <TooltipProvider>
                        <div className={classes}>
                            <Glass className="mx_Dialog_border">
                                <div className="mx_Dialog">{this.staticModal.elem}</div>
                            </Glass>
                            <div
                                data-testid="dialog-background"
                                className="mx_Dialog_background mx_Dialog_staticBackground"
                                onClick={this.onBackgroundClick}
                            />
                        </div>
                    </TooltipProvider>
                </StrictMode>
            );

            ModalManager.getOrCreateStaticRoot().render(staticDialog);
        } else {
            // This is safe to call repeatedly if we happen to do that
            ModalManager.getOrCreateStaticRoot().render(<></>);
        }

        const modal = this.getCurrentModal();
        if (modal !== this.staticModal && !modal.hidden) {
            const classes = classNames("mx_Dialog_wrapper", modal.className, {
                mx_Dialog_wrapperWithStaticUnder: this.staticModal,
            });

            const dialog = (
                <StrictMode>
                    <TooltipProvider>
                        <div className={classes}>
                            <Glass className="mx_Dialog_border">
                                <div className="mx_Dialog">{modal.elem}</div>
                            </Glass>
                            <div
                                data-testid="dialog-background"
                                className="mx_Dialog_background"
                                onClick={this.onBackgroundClick}
                            />
                        </div>
                    </TooltipProvider>
                </StrictMode>
            );

            ModalManager.getOrCreateRoot().render(dialog);
        } else {
            // This is safe to call repeatedly if we happen to do that
            ModalManager.getOrCreateRoot().render(<></>);
        }
    }
}

if (!window.singletonModalManager) {
    window.singletonModalManager = new ModalManager();
}
export default window.singletonModalManager;
