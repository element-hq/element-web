/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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
    const toastRack = useRef(new ToastRack());

    const [activeToast, setActiveToast] = useState<ReactNode | undefined>(toastRack.current.getActiveToast());

    const updateCallback = useCallback(() => {
        setActiveToast(toastRack.current.getActiveToast());
    }, [setActiveToast, toastRack]);

    useEffect(() => {
        toastRack.current.setCallback(updateCallback);
    }, [toastRack, updateCallback]);

    return [activeToast, toastRack.current];
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
