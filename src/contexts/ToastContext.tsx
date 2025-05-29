/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState, useMemo } from "react";

/**
 * A ToastContext helps components display any kind of toast message and can be provided
 * by a parent component such that their children can display toasts, eg. a settings dialog
 * can provide a ToastContext such that controls within it can display toasts at the bottom
 * of the dialog.
 *
 * It is not (at time of writing) used by the *other* toasts that appear in the top right
 * corner of the app, however the name 'toast' as used in this class refers to the component
 * of the same name in compound that it is written to manage.
 */
export const ToastContext = createContext(null as any);
ToastContext.displayName = "ToastContext";

/**
 * Returns the ToastRack in context in order to display toasts
 */
export function useToastContext(): ToastRack {
    return useContext(ToastContext);
}

/**
 * For components that wish to display toasts, return the currently active toast and
 * the ToastRack object that should be provided to the context
 */
export function useActiveToast(): [ReactNode | undefined, ToastRack] {
    const toastRack = useMemo(() => new ToastRack(), []);

    const [activeToast, setActiveToast] = useState<ReactNode | undefined>(toastRack.getActiveToast());

    const updateCallback = useCallback(() => {
        setActiveToast(toastRack.getActiveToast());
    }, [setActiveToast, toastRack]);

    useEffect(() => {
        toastRack.setCallback(updateCallback);
    }, [toastRack, updateCallback]);

    return [activeToast, toastRack];
}

interface DisplayedToast {
    id: number;
    contents: ReactNode;
}

type RemoveCallback = () => void;

export class ToastRack {
    private currentToast: DisplayedToast | undefined;
    private updateCallback?: () => void;
    private idSeq = 0;

    public setCallback(cb: () => void): void {
        this.updateCallback = cb;
    }

    public displayToast(contents: ReactNode): RemoveCallback {
        const newToastId = ++this.idSeq;

        this.currentToast = { id: newToastId, contents: contents };
        this.updateCallback?.();
        const removeFn = (): void => {
            if (this.currentToast?.id === newToastId) {
                this.currentToast = undefined;
                this.updateCallback?.();
            }
        };

        return removeFn;
    }

    public getActiveToast(): ReactNode | undefined {
        return this.currentToast?.contents;
    }
}
