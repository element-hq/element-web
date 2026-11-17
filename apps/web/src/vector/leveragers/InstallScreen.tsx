/*
Copyright 2026 Leveragers.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../languageHandler";
import { installScreenCss } from "./installScreenStyles";
import {
    clearDeferredPrompt,
    getDeferredPrompt,
    type InstallCase,
    type InstallOs,
    rememberDismissal,
} from "./installScreen";

type Screen = InstallCase | "success";

const ICON = "vector-icons/120.png";

/** Ouvre l'app installée : le manifest la déclare pour ce type de lien (`protocol_handlers`). */
export const OPEN_APP_URL = "web+leveragers:open";

const kbd = (sub: string): JSX.Element => <kbd>{sub}</kbd>;

function Icon({ name, size = 16 }: { name: "shield" | "lock" | "check"; size?: number }): JSX.Element {
    const paths: Record<typeof name, JSX.Element> = {
        shield: (
            <>
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                <path d="m9 12 2 2 4-4" />
            </>
        ),
        lock: (
            <>
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </>
        ),
        check: <path d="M20 6 9 17l-5-5" />,
    };
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={name === "check" ? 2.25 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths[name]}
        </svg>
    );
}

function Mark(): JSX.Element {
    return (
        <svg width="36" height="36" viewBox="0 0 28 28" role="img" aria-label="Leveragers">
            <path
                d="M25.4887 0H2.51132C1.12436 0 0 1.12436 0 2.51132V25.4887C0 26.8756 1.12436 28 2.51132 28H25.4887C26.8756 28 28 26.8756 28 25.4887V2.51132C28 1.12436 26.8756 0 25.4887 0Z"
                fill="#2CF8E5"
            />
            <path
                d="M10.6581 5.47342C11.1541 4.97743 12.0029 5.32902 12.0029 6.03093V20.4271C12.0029 21.1692 12.9333 21.4994 13.4017 20.9243L19.7955 13.0689C20.2639 12.4938 21.1943 12.8253 21.1943 13.5662V21.9866C21.1943 22.4223 20.8415 22.7752 20.4058 22.7752H7.35569C6.91998 22.7752 6.56714 22.4223 6.56714 21.9866V10.7849C6.56714 10.6041 6.62992 10.4283 6.74419 10.2876L10.6581 5.47342Z"
                fill="#0A082B"
            />
            <path
                d="M19.2042 9.68116C20.4345 9.68116 21.4318 8.68386 21.4318 7.45362C21.4318 6.22338 20.4345 5.22607 19.2042 5.22607C17.974 5.22607 16.9767 6.22338 16.9767 7.45362C16.9767 8.68386 17.974 9.68116 19.2042 9.68116Z"
                fill="#0A082B"
            />
        </svg>
    );
}

function Cursor(): JSX.Element {
    return (
        <svg className="cursor" viewBox="0 0 18 18" aria-hidden="true">
            <path
                d="M2 1.5v13.2l3.4-3.1 2.3 5 2.2-1-2.2-4.9 4.6-.2z"
                fill="#111"
                stroke="#fff"
                strokeWidth="1.2"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function AppWindow({
    title,
    controls,
    style,
    rows = 4,
}: {
    title: string;
    controls?: boolean;
    style?: React.CSSProperties;
    rows?: number;
}): JSX.Element {
    return (
        <div className="appwin" style={style}>
            <div className="tb">
                {controls ? (
                    <>
                        <span>{title}</span>
                        <span className="ctl">–▢✕</span>
                    </>
                ) : (
                    <>
                        <i />
                        <i />
                        <i />
                        <span style={{ marginLeft: 6 }}>{title}</span>
                    </>
                )}
            </div>
            <div className="bd">
                <div className="sd">
                    {Array.from({ length: rows }, (_, i) => (
                        <div className="r" key={i}>
                            <b />
                            <s />
                        </div>
                    ))}
                </div>
                <div className="mn">
                    <u />
                    <u className="me" />
                    {rows > 3 && <u />}
                </div>
            </div>
        </div>
    );
}

type Scene = "mac" | "win" | "safari" | "intro-mac" | "intro-win";

/** Illustration : mockup du bureau avec l'app dans le Dock (intro) ou animation du geste à faire. Décorative. */
function Stage({ scene }: { scene: Scene }): JSX.Element {
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const fit = (): void => el.style.setProperty("--s", String(el.clientWidth / 480));
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const brand = "Agents by Leveragers";
    let content: JSX.Element;
    if (scene === "intro-mac" || scene === "intro-win") {
        const app = (
            <span className="me">
                <img src={ICON} alt="" />
                <b className="tip">Agents</b>
            </span>
        );
        content =
            scene === "intro-mac" ? (
                <>
                    <AppWindow title={brand} />
                    <div className="dock">
                        <span />
                        <span />
                        <span />
                        {app}
                        <span />
                    </div>
                </>
            ) : (
                <>
                    <AppWindow title={brand} controls style={{ top: 26 }} />
                    <div className="taskbar">
                        <span />
                        <span />
                        <span />
                        {app}
                        <span />
                    </div>
                </>
            );
    } else if (scene === "mac") {
        content = (
            <>
                <AppWindow title={brand} />
                <div className="dock">
                    <span />
                    <span />
                    <span />
                    <span className="me">
                        <img src={ICON} alt="" />
                    </span>
                    <span />
                </div>
                <div className="menu m1">
                    <div className="opt">
                        {_t("leveragers_install|demo|options")} <span>›</span>
                    </div>
                    <hr />
                    <div>{_t("leveragers_install|demo|show_all_windows")}</div>
                    <div>{_t("leveragers_install|demo|hide")}</div>
                    <div>{_t("leveragers_install|demo|quit")}</div>
                </div>
                <div className="menu m2">
                    <div className="keep">{_t("leveragers_install|demo|keep_in_dock")}</div>
                    <div>{_t("leveragers_install|demo|open_at_login")}</div>
                    <div>{_t("leveragers_install|demo|show_in_finder")}</div>
                </div>
                <div className="badge">✓ {_t("leveragers_install|demo|stays_in_dock")}</div>
            </>
        );
    } else if (scene === "win") {
        content = (
            <>
                <AppWindow title={brand} controls style={{ top: 26 }} />
                <div className="taskbar">
                    <span />
                    <span />
                    <span />
                    <span className="me">
                        <img src={ICON} alt="" />
                    </span>
                    <span />
                </div>
                <div className="menu win-menu m1">
                    <div>{brand}</div>
                    <hr />
                    <div className="pin">📌 {_t("leveragers_install|demo|pin_to_taskbar")}</div>
                    <div>✕ {_t("leveragers_install|demo|close_window")}</div>
                </div>
                <div className="badge">✓ {_t("leveragers_install|demo|stays_in_taskbar")}</div>
            </>
        );
    } else {
        content = (
            <>
                <div className="menubar">
                    <b />
                    <b>Safari</b>
                    <span className="fichier">{_t("leveragers_install|demo|file")}</span>
                    <span>{_t("leveragers_install|demo|edit")}</span>
                    <span>{_t("leveragers_install|demo|view")}</span>
                </div>
                <AppWindow
                    title={window.location.host}
                    rows={3}
                    style={{ top: 40, left: 90, width: 300, height: 170 }}
                />
                <div className="dock">
                    <span />
                    <span />
                    <span />
                    <span className="me">
                        <img src={ICON} alt="" />
                    </span>
                    <span />
                </div>
                <div className="menu m1">
                    <div>{_t("leveragers_install|demo|new_window")}</div>
                    <div>{_t("leveragers_install|demo|new_tab")}</div>
                    <hr />
                    <div className="add">{_t("leveragers_install|demo|add_to_dock")}</div>
                    <div>{_t("leveragers_install|demo|share")}</div>
                </div>
                <div className="sdialog">
                    <img src={ICON} alt="" />
                    <div>{_t("leveragers_install|demo|add_to_dock_title")}</div>
                    <div className="bt">
                        <span>{_t("leveragers_install|demo|cancel")}</span>
                        <span className="go">{_t("leveragers_install|demo|add")}</span>
                    </div>
                </div>
                <div className="badge">✓ {_t("leveragers_install|demo|in_dock")}</div>
            </>
        );
    }

    return (
        <div className="lvgI-stage-wrap" aria-hidden="true">
            <div className="lvgI-stage-box" ref={box}>
                <div className={`lvgI-stage s-${scene}`}>
                    {content}
                    <span className="ring" />
                    <Cursor />
                </div>
            </div>
        </div>
    );
}

interface Props {
    initialCase: InstallCase;
    os: InstallOs;
    onContinue: () => void;
}

export function InstallScreen({ initialCase, os, onContinue }: Props): JSX.Element {
    const [screen, setScreen] = useState<Screen>(initialCase);
    const [busy, setBusy] = useState(false);
    const [noPrompt, setNoPrompt] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Installée par un autre chemin (icône de la barre d'adresse) pendant que l'écran est ouvert.
        const onInstalled = (): void => setScreen("success");
        window.addEventListener("appinstalled", onInstalled);
        return () => window.removeEventListener("appinstalled", onInstalled);
    }, []);

    const install = async (): Promise<void> => {
        const prompt = getDeferredPrompt();
        // No install offer from the browser (private window, policy, already installed…):
        // the button shows how to install by hand instead of doing nothing.
        if (!prompt) {
            setNoPrompt(true);
            return;
        }
        setBusy(true);
        try {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            // La fenêtre de Chrome ne s'ouvre qu'une fois par évènement.
            clearDeferredPrompt();
            if (outcome === "accepted") setScreen("success");
        } catch (e) {
            logger.warn("Install prompt failed", e);
            clearDeferredPrompt();
            setNoPrompt(true);
        } finally {
            setBusy(false);
        }
    };

    const dismiss = (): void => {
        rememberDismissal();
        onContinue();
    };

    const copyAddress = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(window.location.origin);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    // À droite, sous les consignes : avant installation le mockup du bureau avec l'app dans le Dock,
    // après installation l'animation du geste pour l'y garder. Safari : l'animation de ses 2 étapes.
    const scene: Scene =
        screen === "success" || screen === "installed" ? os : screen === "safari" ? "safari" : `intro-${os}`;

    const continueLink = (label: string, onClick: () => void): JSX.Element => (
        <p className="lvgI-more">
            <button type="button" className="lvgI-link" onClick={onClick}>
                {label}
            </button>
        </p>
    );

    let main: JSX.Element;
    if (screen === "chromium") {
        main = (
            <>
                <h1 id="lvgI-title">{_t("leveragers_install|brand_title")}</h1>
                <p className="lvgI-lead">{_t("leveragers_install|install_lead")}</p>
                <div className="lvgI-actions">
                    <button type="button" className="lvgI-btn lvgI-btn-primary" onClick={install} disabled={busy}>
                        {_t("leveragers_install|install_button")}
                    </button>
                </div>
                <p className="lvgI-note">{_t("leveragers_install|install_body")}</p>
                {noPrompt && (
                    <p className="lvgI-hint" role="status">
                        {_t("leveragers_install|install_unavailable")}
                    </p>
                )}
                {continueLink(_t("leveragers_install|continue_browser"), dismiss)}
            </>
        );
    } else if (screen === "success") {
        main = (
            <>
                <p className="lvgI-done">
                    <Icon name="check" />
                    {_t("leveragers_install|success_label")}
                </p>
                <h1 id="lvgI-title">
                    {os === "mac"
                        ? _t("leveragers_install|success_title_mac")
                        : _t("leveragers_install|success_title_windows")}
                </h1>
                <p className="lvgI-lead">
                    {_t("leveragers_install|success_body")}{" "}
                    {os === "mac"
                        ? _t("leveragers_install|success_how_mac", {}, { kbd })
                        : _t("leveragers_install|success_how_windows", {}, { kbd })}
                </p>
                <p className="lvgI-lead">{_t("leveragers_install|success_close_tab")}</p>
                {continueLink(_t("leveragers_install|stay_browser"), onContinue)}
            </>
        );
    } else if (screen === "installed") {
        main = (
            <>
                <h1 id="lvgI-title">{_t("leveragers_install|installed_title")}</h1>
                <p className="lvgI-lead">{_t("leveragers_install|installed_lead")}</p>
                <div className="lvgI-actions">
                    {/* Lien que l'app installée sait ouvrir (`protocol_handlers` du manifest). */}
                    <a className="lvgI-btn lvgI-btn-primary" href={OPEN_APP_URL}>
                        {_t("leveragers_install|open_app")}
                    </a>
                </div>
                <p className="lvgI-note">
                    {os === "mac"
                        ? _t("leveragers_install|installed_fallback_mac")
                        : _t("leveragers_install|installed_fallback_windows")}
                </p>
                {continueLink(_t("leveragers_install|continue_browser"), dismiss)}
            </>
        );
    } else if (screen === "safari") {
        main = (
            <>
                <h1 id="lvgI-title">{_t("leveragers_install|brand_title")}</h1>
                <p className="lvgI-lead">{_t("leveragers_install|install_lead")}</p>
                <ol className="lvgI-steps">
                    <li>
                        <span className="lvgI-n">1</span>
                        <div>
                            <strong>{_t("leveragers_install|safari_step1_title")}</strong>
                            <span className="lvgI-d">{_t("leveragers_install|safari_step1_body", {}, { kbd })}</span>
                        </div>
                    </li>
                    <li>
                        <span className="lvgI-n">2</span>
                        <div>
                            <strong>{_t("leveragers_install|safari_step2_title")}</strong>
                            <span className="lvgI-d">{_t("leveragers_install|safari_step2_body", {}, { kbd })}</span>
                        </div>
                    </li>
                </ol>
                <p className="lvgI-note">{_t("leveragers_install|safari_requirement")}</p>
                <p className="lvgI-note">{_t("leveragers_install|safari_prefer_chrome", {}, { kbd })}</p>
                {continueLink(_t("leveragers_install|continue_browser"), dismiss)}
            </>
        );
    } else {
        main = (
            <>
                <h1 id="lvgI-title">{_t("leveragers_install|firefox_title")}</h1>
                <p className="lvgI-lead">{_t("leveragers_install|firefox_body")}</p>
                <div className="lvgI-actions">
                    <button type="button" className="lvgI-btn lvgI-btn-primary" onClick={copyAddress}>
                        {copied ? _t("leveragers_install|address_copied") : _t("leveragers_install|copy_address")}
                    </button>
                </div>
                {continueLink(_t("leveragers_install|continue_firefox"), dismiss)}
            </>
        );
    }

    return (
        <div className="lvgInstall" role="dialog" aria-modal="true" aria-labelledby="lvgI-title">
            <aside className="lvgI-brand">
                <div className="lvgI-lockup">
                    <Mark />
                    <div>
                        <p className="lvgI-name lvgI-display">Agents</p>
                        <p className="lvgI-by">by Leveragers</p>
                    </div>
                </div>
                <div className="lvgI-pitch">
                    <h2>{_t("leveragers_install|hero_title")}</h2>
                    <p>{_t("leveragers_install|brand_pitch")}</p>
                </div>
                <ul>
                    <li>
                        <Icon name="shield" />
                        {_t("leveragers_install|brand_encrypted")}
                    </li>
                    <li>
                        <Icon name="lock" />
                        {_t("leveragers_install|brand_private")}
                    </li>
                </ul>
            </aside>
            <main className="lvgI-main">
                <section className="lvgI-content">
                    {main}
                    <Stage key={scene} scene={scene} />
                </section>
            </main>
        </div>
    );
}

/**
 * Affiche l'écran par-dessus la page et attend que la personne continue dans le navigateur.
 * L'écran a sa propre racine React, retirée ensuite : la racine d'Element n'est pas touchée.
 */
export function renderInstallScreen(initialCase: InstallCase, os: InstallOs): Promise<void> {
    return new Promise((resolve) => {
        const style = document.createElement("style");
        style.textContent = installScreenCss;
        const container = document.createElement("div");
        let root: Root | undefined;
        let finished = false;
        // Once installed, Chrome and Edge move this very tab into the app window without reloading
        // it: the check made at start (`display-mode`) no longer holds. Step aside as soon as the page
        // becomes the app, without remembering a « stay in the browser » choice.
        const standalone = window.matchMedia?.("(display-mode: standalone)");
        const onDisplayMode = (): void => {
            if (standalone?.matches) done();
        };
        // Safe to call more than once; always hands over to the app, whatever went wrong.
        const done = (): void => {
            if (finished) return;
            finished = true;
            standalone?.removeEventListener?.("change", onDisplayMode);
            try {
                root?.unmount();
            } catch (e) {
                logger.warn("Install screen: unmount failed", e);
            }
            container.remove();
            style.remove();
            resolve();
        };
        try {
            standalone?.addEventListener?.("change", onDisplayMode);
            document.head.appendChild(style);
            document.body.appendChild(container);
            root = createRoot(container, {
                // A render error would otherwise leave a blank page: React unmounts the tree and
                // nobody calls `done`. Deferred so the root is not unmounted from inside React.
                onUncaughtError: (error) => {
                    logger.warn("Install screen failed, opening the app", error);
                    setTimeout(done);
                },
            });
            root.render(
                <StrictMode>
                    <InstallScreen initialCase={initialCase} os={os} onContinue={done} />
                </StrictMode>,
            );
        } catch (e) {
            logger.warn("Install screen failed, opening the app", e);
            done();
        }
    });
}
