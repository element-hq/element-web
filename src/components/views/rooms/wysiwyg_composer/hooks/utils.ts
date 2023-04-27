/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MutableRefObject, RefObject } from "react";

import { TimelineRenderingType } from "../../../../../contexts/RoomContext";
import { IRoomState } from "../../../../structures/RoomView";
import Autocomplete from "../../Autocomplete";
import { getKeyBindingsManager } from "../../../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../../../accessibility/KeyboardShortcuts";

export function focusComposer(
    composerElement: MutableRefObject<HTMLElement | null>,
    renderingType: TimelineRenderingType,
    roomContext: IRoomState,
    timeoutId: MutableRefObject<number | null>,
): void {
    if (renderingType === roomContext.timelineRenderingType) {
        // Immediately set the focus, so if you start typing it
        // will appear in the composer
        composerElement.current?.focus();
        // If we call focus immediate, the focus _is_ in the right
        // place, but the cursor is invisible, presumably because
        // some other event is still processing.
        // The following line ensures that the cursor is actually
        // visible in composer.
        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
        }
        timeoutId.current = window.setTimeout(() => composerElement.current?.focus(), 200);
    }
}

export function setCursorPositionAtTheEnd(element: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    element.focus();
}

/**
 * When the autocomplete modal is open we need to be able to properly
 * handle events that are dispatched. This allows the user to move the selection
 * in the autocomplete and select using enter.
 *
 * @param autocompleteRef - a ref to the autocomplete of interest
 * @param event - the keyboard event that has been dispatched
 * @returns boolean - whether or not the autocomplete has handled the event
 */
export function handleEventWithAutocomplete(
    autocompleteRef: RefObject<Autocomplete>,
    // we get a React Keyboard event from plain text composer, a Keyboard Event from the rich text composer
    event: KeyboardEvent | React.KeyboardEvent<HTMLDivElement>,
): boolean {
    const autocompleteIsOpen = autocompleteRef?.current && !autocompleteRef.current.state.hide;

    if (!autocompleteIsOpen) {
        return false;
    }

    let handled = false;
    const autocompleteAction = getKeyBindingsManager().getAutocompleteAction(event);
    const component = autocompleteRef.current;

    if (component && component.countCompletions() > 0) {
        switch (autocompleteAction) {
            case KeyBindingAction.ForceCompleteAutocomplete:
            case KeyBindingAction.CompleteAutocomplete:
                autocompleteRef.current.onConfirmCompletion();
                handled = true;
                break;
            case KeyBindingAction.PrevSelectionInAutocomplete:
                autocompleteRef.current.moveSelection(-1);
                handled = true;
                break;
            case KeyBindingAction.NextSelectionInAutocomplete:
                autocompleteRef.current.moveSelection(1);
                handled = true;
                break;
            case KeyBindingAction.CancelAutocomplete:
                autocompleteRef.current.onEscape(event as {} as React.KeyboardEvent);
                handled = true;
                break;
            default:
                break; // don't return anything, allow event to pass through
        }
    }

    if (handled) {
        event.preventDefault();
        event.stopPropagation();
    }

    return handled;
}
