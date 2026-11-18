/*
Copyright 2026 Leveragers.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "test-utils-rtl";

import { InstallScreen, OPEN_APP_URL, renderInstallScreen } from "./InstallScreen";
import { clearDeferredPrompt } from "./installScreen";

let failRender = false;

vi.mock("../../languageHandler", async (importOriginal) => {
    const original = await importOriginal<typeof import("../../languageHandler")>();
    return {
        ...original,
        _t: ((...args: Parameters<typeof original._t>) => {
            if (failRender) throw new Error("render failure");
            return original._t(...args);
        }) as typeof original._t,
    };
});

/** Chrome's install event, as captured by `installScreen.ts`. */
function offerInstall(prompt: () => Promise<void>, outcome: "accepted" | "dismissed" = "accepted"): void {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
    window.dispatchEvent(event);
}

function installButton(): HTMLElement {
    // The first button of the Chrome/Edge screen is the install button.
    return screen.getAllByRole("button")[0];
}

describe("InstallScreen install button", () => {
    afterEach(() => {
        clearDeferredPrompt();
        failRender = false;
    });

    it("shows how to install by hand when the browser offers no install", () => {
        render(<InstallScreen initialCase="chromium" os="win" onContinue={vi.fn()} />);
        expect(screen.queryByRole("status")).toBeNull();
        fireEvent.click(installButton());
        expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("opens the browser's install window when it is offered", async () => {
        const prompt = vi.fn().mockResolvedValue(undefined);
        offerInstall(prompt);
        render(<InstallScreen initialCase="chromium" os="mac" onContinue={vi.fn()} />);
        await act(async () => fireEvent.click(installButton()));
        expect(prompt).toHaveBeenCalled();
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("falls back to the manual steps when the install window fails", async () => {
        offerInstall(vi.fn().mockRejectedValue(new Error("already shown")));
        render(<InstallScreen initialCase="chromium" os="mac" onContinue={vi.fn()} />);
        await act(async () => fireEvent.click(installButton()));
        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(installButton()).not.toBeDisabled();
    });
});

describe("InstallScreen other screens", () => {
    it("offers to open the installed app, with a link the app handles", () => {
        render(<InstallScreen initialCase="installed" os="mac" onContinue={vi.fn()} />);
        expect(screen.getByRole("link")).toHaveAttribute("href", OPEN_APP_URL);
    });

    it("shows the Safari animation of its 2 steps", () => {
        const { container } = render(<InstallScreen initialCase="safari" os="mac" onContinue={vi.fn()} />);
        expect(container.querySelector(".s-safari")).not.toBeNull();
    });
});

describe("renderInstallScreen", () => {
    afterEach(() => {
        failRender = false;
    });

    it("hands over to the app when the person continues, and cleans up", async () => {
        const before = document.body.childElementCount;
        const shown = renderInstallScreen("firefox", "win");
        const buttons = await screen.findAllByRole("button");
        // Last button: « Continue in Firefox ». Clicking twice must not break anything.
        act(() => {
            fireEvent.click(buttons[buttons.length - 1]);
            fireEvent.click(buttons[buttons.length - 1]);
        });
        await expect(shown).resolves.toBeUndefined();
        expect(document.body.childElementCount).toBe(before);
    });

    it("steps aside, without remembering a choice, when the tab becomes the installed app", async () => {
        // Chrome and Edge move the tab into the app window after install, without reloading it.
        let standalone = false;
        const listeners = new Set<() => void>();
        const query = {
            get matches() {
                return standalone;
            },
            addEventListener: (_: string, cb: () => void) => listeners.add(cb),
            removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
        };
        const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue(query as unknown as MediaQueryList);
        // eslint-disable-next-line unicorn/no-document-cookie -- same cookie as the code under test
        document.cookie = "lvg_install_screen_dismissed=; Max-Age=0; Path=/";
        const before = document.body.childElementCount;
        const shown = renderInstallScreen("chromium", "win");
        await screen.findAllByRole("button");
        expect(listeners.size).toBe(1);

        standalone = true;
        act(() => listeners.forEach((cb) => cb()));

        await expect(shown).resolves.toBeUndefined();
        expect(document.body.childElementCount).toBe(before);
        expect(listeners.size).toBe(0);
        expect(document.cookie).not.toContain("lvg_install_screen_dismissed=1");
        matchMedia.mockRestore();
    });

    it("hands over to the app when the screen fails to render", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        failRender = true;
        const before = document.body.childElementCount;
        const shown = renderInstallScreen("chromium", "win");
        await waitFor(() => expect(document.body.childElementCount).toBe(before));
        await expect(shown).resolves.toBeUndefined();
    });
});
