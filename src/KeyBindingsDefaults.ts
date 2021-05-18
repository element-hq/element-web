/*
Copyright 2021 Clemens Zeidler

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

import { AutocompleteAction, IKeyBindingsProvider, KeyBinding, MessageComposerAction, NavigationAction, RoomAction,
    RoomListAction } from "./KeyBindingsManager";
import { isMac, Key } from "./Keyboard";
import SettingsStore from "./settings/SettingsStore";

const messageComposerBindings = (): KeyBinding<MessageComposerAction>[] => {
    const bindings: KeyBinding<MessageComposerAction>[] = [
        {
            action: MessageComposerAction.SelectPrevSendHistory,
            keyCombo: {
                key: Key.ARROW_UP,
                altKey: true,
                ctrlKey: true,
            },
        },
        {
            action: MessageComposerAction.SelectNextSendHistory,
            keyCombo: {
                key: Key.ARROW_DOWN,
                altKey: true,
                ctrlKey: true,
            },
        },
        {
            action: MessageComposerAction.EditPrevMessage,
            keyCombo: {
                key: Key.ARROW_UP,
            },
        },
        {
            action: MessageComposerAction.EditNextMessage,
            keyCombo: {
                key: Key.ARROW_DOWN,
            },
        },
        {
            action: MessageComposerAction.CancelEditing,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: MessageComposerAction.FormatBold,
            keyCombo: {
                key: Key.B,
                ctrlOrCmd: true,
            },
        },
        {
            action: MessageComposerAction.FormatItalics,
            keyCombo: {
                key: Key.I,
                ctrlOrCmd: true,
            },
        },
        {
            action: MessageComposerAction.FormatQuote,
            keyCombo: {
                key: Key.GREATER_THAN,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        },
        {
            action: MessageComposerAction.EditUndo,
            keyCombo: {
                key: Key.Z,
                ctrlOrCmd: true,
            },
        },
        {
            action: MessageComposerAction.MoveCursorToStart,
            keyCombo: {
                key: Key.HOME,
                ctrlOrCmd: true,
            },
        },
        {
            action: MessageComposerAction.MoveCursorToEnd,
            keyCombo: {
                key: Key.END,
                ctrlOrCmd: true,
            },
        },
    ];
    if (isMac) {
        bindings.push({
            action: MessageComposerAction.EditRedo,
            keyCombo: {
                key: Key.Z,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        });
    } else {
        bindings.push({
            action: MessageComposerAction.EditRedo,
            keyCombo: {
                key: Key.Y,
                ctrlOrCmd: true,
            },
        });
    }
    if (SettingsStore.getValue('MessageComposerInput.ctrlEnterToSend')) {
        bindings.push({
            action: MessageComposerAction.Send,
            keyCombo: {
                key: Key.ENTER,
                ctrlOrCmd: true,
            },
        });
        bindings.push({
            action: MessageComposerAction.NewLine,
            keyCombo: {
                key: Key.ENTER,
            },
        });
    } else {
        bindings.push({
            action: MessageComposerAction.Send,
            keyCombo: {
                key: Key.ENTER,
            },
        });
        bindings.push({
            action: MessageComposerAction.NewLine,
            keyCombo: {
                key: Key.ENTER,
                shiftKey: true,
            },
        });
        if (isMac) {
            bindings.push({
                action: MessageComposerAction.NewLine,
                keyCombo: {
                    key: Key.ENTER,
                    altKey: true,
                },
            });
        }
    }
    return bindings;
}

const autocompleteBindings = (): KeyBinding<AutocompleteAction>[] => {
    return [
        {
            action: AutocompleteAction.CompleteOrNextSelection,
            keyCombo: {
                key: Key.TAB,
            },
        },
        {
            action: AutocompleteAction.CompleteOrNextSelection,
            keyCombo: {
                key: Key.TAB,
                ctrlKey: true,
            },
        },
        {
            action: AutocompleteAction.CompleteOrPrevSelection,
            keyCombo: {
                key: Key.TAB,
                shiftKey: true,
            },
        },
        {
            action: AutocompleteAction.CompleteOrPrevSelection,
            keyCombo: {
                key: Key.TAB,
                ctrlKey: true,
                shiftKey: true,
            },
        },
        {
            action: AutocompleteAction.Cancel,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: AutocompleteAction.PrevSelection,
            keyCombo: {
                key: Key.ARROW_UP,
            },
        },
        {
            action: AutocompleteAction.NextSelection,
            keyCombo: {
                key: Key.ARROW_DOWN,
            },
        },
    ];
}

const roomListBindings = (): KeyBinding<RoomListAction>[] => {
    return [
        {
            action: RoomListAction.ClearSearch,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: RoomListAction.PrevRoom,
            keyCombo: {
                key: Key.ARROW_UP,
            },
        },
        {
            action: RoomListAction.NextRoom,
            keyCombo: {
                key: Key.ARROW_DOWN,
            },
        },
        {
            action: RoomListAction.SelectRoom,
            keyCombo: {
                key: Key.ENTER,
            },
        },
        {
            action: RoomListAction.CollapseSection,
            keyCombo: {
                key: Key.ARROW_LEFT,
            },
        },
        {
            action: RoomListAction.ExpandSection,
            keyCombo: {
                key: Key.ARROW_RIGHT,
            },
        },
    ];
}

const roomBindings = (): KeyBinding<RoomAction>[] => {
    const bindings: KeyBinding<RoomAction>[] = [
        {
            action: RoomAction.ScrollUp,
            keyCombo: {
                key: Key.PAGE_UP,
            },
        },
        {
            action: RoomAction.RoomScrollDown,
            keyCombo: {
                key: Key.PAGE_DOWN,
            },
        },
        {
            action: RoomAction.DismissReadMarker,
            keyCombo: {
                key: Key.ESCAPE,
            },
        },
        {
            action: RoomAction.JumpToOldestUnread,
            keyCombo: {
                key: Key.PAGE_UP,
                shiftKey: true,
            },
        },
        {
            action: RoomAction.UploadFile,
            keyCombo: {
                key: Key.U,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        },
        {
            action: RoomAction.JumpToFirstMessage,
            keyCombo: {
                key: Key.HOME,
                ctrlKey: true,
            },
        },
        {
            action: RoomAction.JumpToLatestMessage,
            keyCombo: {
                key: Key.END,
                ctrlKey: true,
            },
        },
    ];

    if (SettingsStore.getValue('ctrlFForSearch')) {
        bindings.push({
            action: RoomAction.FocusSearch,
            keyCombo: {
                key: Key.F,
                ctrlOrCmd: true,
            },
        });
    }

    return bindings;
}

const navigationBindings = (): KeyBinding<NavigationAction>[] => {
    return [
        {
            action: NavigationAction.FocusRoomSearch,
            keyCombo: {
                key: Key.K,
                ctrlOrCmd: true,
            },
        },
        {
            action: NavigationAction.ToggleRoomSidePanel,
            keyCombo: {
                key: Key.PERIOD,
                ctrlOrCmd: true,
            },
        },
        {
            action: NavigationAction.ToggleUserMenu,
            // Ideally this would be CTRL+P for "Profile", but that's
            // taken by the print dialog. CTRL+I for "Information"
            // was previously chosen but conflicted with italics in
            // composer, so CTRL+` it is
            keyCombo: {
                key: Key.BACKTICK,
                ctrlOrCmd: true,
            },
        },
        {
            action: NavigationAction.ToggleShortCutDialog,
            keyCombo: {
                key: Key.SLASH,
                ctrlOrCmd: true,
            },
        },
        {
            action: NavigationAction.ToggleShortCutDialog,
            keyCombo: {
                key: Key.SLASH,
                ctrlOrCmd: true,
                shiftKey: true,
            },
        },
        {
            action: NavigationAction.GoToHome,
            keyCombo: {
                key: Key.H,
                ctrlKey: true,
                altKey: !isMac,
                shiftKey: isMac,
            },
        },
        {
            action: NavigationAction.SelectPrevRoom,
            keyCombo: {
                key: Key.ARROW_UP,
                altKey: true,
            },
        },
        {
            action: NavigationAction.SelectNextRoom,
            keyCombo: {
                key: Key.ARROW_DOWN,
                altKey: true,
            },
        },
        {
            action: NavigationAction.SelectPrevUnreadRoom,
            keyCombo: {
                key: Key.ARROW_UP,
                altKey: true,
                shiftKey: true,
            },
        },
        {
            action: NavigationAction.SelectNextUnreadRoom,
            keyCombo: {
                key: Key.ARROW_DOWN,
                altKey: true,
                shiftKey: true,
            },
        },
    ];
}

export const defaultBindingsProvider: IKeyBindingsProvider = {
    getMessageComposerBindings: messageComposerBindings,
    getAutocompleteBindings: autocompleteBindings,
    getRoomListBindings: roomListBindings,
    getRoomBindings: roomBindings,
    getNavigationBindings: navigationBindings,
}
