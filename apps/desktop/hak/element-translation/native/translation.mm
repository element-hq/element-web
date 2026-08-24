/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Native macOS translation popover, backed by the private TranslationUI.framework
// (the same approach Safari/Helium use). Everything is guarded so that any failure
// to load the private framework simply reports "not available" rather than crashing.

#include <node_api.h>

#import <Cocoa/Cocoa.h>
#import <objc/message.h>
#import <objc/runtime.h>

// Keep the currently presented popover alive
static NSPopover *sCurrentPopover = nil;
// Local event monitor used to dismiss the popover when the user scrolls. In Electron the
// timeline scroll is a Chromium/DOM scroll, not a native NSScrollView event, so NSPopover's
// Transient behaviour never sees it — we watch the raw scroll NSEvent instead.
static id sScrollMonitor = nil;

// Tear down the active popover + scroll monitor. Must run on the main thread.
static void DismissCurrentPopover(void) {
    if (sScrollMonitor) {
        [NSEvent removeMonitor:sScrollMonitor];
        sScrollMonitor = nil;
    }
    if (sCurrentPopover) {
        [sCurrentPopover close];
        sCurrentPopover = nil;
    }
}

// Resolve the private `LTUITranslationViewController` class from TranslationUI.framework.
// Cached; returns nil (once) if the framework can't be loaded or the class is missing.
static Class TranslationViewControllerClass(void) {
    static Class cls = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        @try {
            NSBundle *bundle =
                [NSBundle bundleWithPath:@"/System/Library/PrivateFrameworks/TranslationUI.framework"];
            if (bundle && [bundle load]) {
                cls = NSClassFromString(@"LTUITranslationViewController");
            }
        } @catch (__unused NSException *e) {
            cls = nil;
        }
    });
    return cls;
}

// isAvailable(): boolean
static napi_value IsAvailable(napi_env env, napi_callback_info info) {
    bool available = (TranslationViewControllerClass() != nil);
    napi_value result;
    napi_get_boolean(env, available, &result);
    return result;
}

// showTranslation(viewHandle: Buffer, text: string, x: number, y: number, width: number, height: number): void
// `viewHandle` is BrowserWindow.getNativeWindowHandle() — a Buffer wrapping the NSView* pointer.
// The rect is expected to already be in the source view's (AppKit, bottom-left origin) coordinate space.
static napi_value ShowTranslation(napi_env env, napi_callback_info info) {
    size_t argc = 6;
    napi_value argv[6];
    if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc < 6) {
        return NULL;
    }

    void *bufData = NULL;
    size_t bufLen = 0;
    if (napi_get_buffer_info(env, argv[0], &bufData, &bufLen) != napi_ok || !bufData ||
        bufLen < sizeof(void *)) {
        return NULL;
    }
    NSView *sourceView = (__bridge NSView *)(*reinterpret_cast<void **>(bufData));

    size_t textLen = 0;
    napi_get_value_string_utf8(env, argv[1], NULL, 0, &textLen);
    char *textBuf = static_cast<char *>(malloc(textLen + 1));
    if (!textBuf) return NULL;
    napi_get_value_string_utf8(env, argv[1], textBuf, textLen + 1, &textLen);
    NSString *text = [NSString stringWithUTF8String:textBuf];
    free(textBuf);

    double x = 0, y = 0, w = 0, h = 0;
    napi_get_value_double(env, argv[2], &x);
    napi_get_value_double(env, argv[3], &y);
    napi_get_value_double(env, argv[4], &w);
    napi_get_value_double(env, argv[5], &h);
    NSRect rect = NSMakeRect(x, y, w, h);

    Class cls = TranslationViewControllerClass();
    if (!cls || !sourceView || text.length == 0) {
        return NULL;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            id vc = [[cls alloc] initWithNibName:nil bundle:nil];

            SEL setTextSel = NSSelectorFromString(@"setText:");
            SEL setSourceViewSel = NSSelectorFromString(@"setSourceView:");
            SEL setEditableSel = NSSelectorFromString(@"setIsSourceEditable:");

            NSAttributedString *attr = [[NSAttributedString alloc] initWithString:text];
            if ([vc respondsToSelector:setTextSel]) {
                ((void (*)(id, SEL, NSAttributedString *))objc_msgSend)(vc, setTextSel, attr);
            }
            if ([vc respondsToSelector:setSourceViewSel]) {
                ((void (*)(id, SEL, NSView *))objc_msgSend)(vc, setSourceViewSel, sourceView);
            }
            if ([vc respondsToSelector:setEditableSel]) {
                ((void (*)(id, SEL, BOOL))objc_msgSend)(vc, setEditableSel, NO);
            }

            NSPopover *popover = [[NSPopover alloc] init];
            popover.behavior = NSPopoverBehaviorTransient;
            popover.contentViewController = (NSViewController *)vc;

            // Replace any popover/monitor still around from a previous invocation.
            DismissCurrentPopover();

            sCurrentPopover = popover; // retain across the run loop so it isn't dismissed instantly
            [popover showRelativeToRect:rect ofView:sourceView preferredEdge:NSRectEdgeMaxY];

            // Dismiss the popover as soon as the user scrolls outside it (e.g. the room timeline).
            sScrollMonitor = [NSEvent
                addLocalMonitorForEventsMatchingMask:NSEventMaskScrollWheel
                                             handler:^NSEvent *(NSEvent *event) {
                                                 NSWindow *popoverWindow =
                                                     sCurrentPopover.contentViewController.view.window;
                                                 if (event.window && event.window == popoverWindow) {
                                                     return event; // scroll inside the popover — keep open
                                                 }
                                                 DismissCurrentPopover();
                                                 return event;
                                             }];
        } @catch (NSException *e) {
            NSLog(@"[element-translation] failed to present translation popover: %@", e);
            sCurrentPopover = nil;
        }
    });

    return NULL;
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_value fnAvailable, fnShow;
    napi_create_function(env, NULL, 0, IsAvailable, NULL, &fnAvailable);
    napi_set_named_property(env, exports, "isAvailable", fnAvailable);
    napi_create_function(env, NULL, 0, ShowTranslation, NULL, &fnShow);
    napi_set_named_property(env, exports, "showTranslation", fnShow);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
