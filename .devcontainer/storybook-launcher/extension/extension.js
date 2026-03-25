const http = require("node:http");
const vscode = require("vscode");

const STORYBOOK_PORT = 6007;
const STORYBOOK_PATH = "/?path=/story/ai-prototypes-get-started--setup-guide";
const STORYBOOK_LOCAL = `http://localhost:${STORYBOOK_PORT}${STORYBOOK_PATH}`;

const ELEMENT_WEB_PORT = 8080;
const ELEMENT_WEB_LOCAL = `http://localhost:${ELEMENT_WEB_PORT}/`;

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 120_000;
const ELEMENT_WEB_MAX_WAIT_MS = 300_000; // webpack build takes longer

/** Probe a local server. Returns true if it responds with a non-5xx status. */
function isServerReady(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/`, { timeout: 2000 }, (res) => {
            res.resume();
            resolve(res.statusCode < 500);
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function getStorybookUri() {
    return vscode.env.asExternalUri(vscode.Uri.parse(STORYBOOK_LOCAL));
}

async function getElementWebUri() {
    return vscode.env.asExternalUri(vscode.Uri.parse(ELEMENT_WEB_LOCAL));
}

async function openStorybookInBrowser() {
    vscode.env.openExternal(await getStorybookUri());
}

async function openStorybookPreview() {
    const uri = await getStorybookUri();
    vscode.commands.executeCommand("simpleBrowser.show", uri.toString());
}

async function openElementWebInBrowser() {
    vscode.env.openExternal(await getElementWebUri());
}

async function openElementWebPreview() {
    const uri = await getElementWebUri();
    vscode.commands.executeCommand("simpleBrowser.show", uri.toString());
}

/** Poll until the server on `port` is ready or `maxWait` ms elapses. */
async function waitForServer(port, maxWait) {
    if (await isServerReady(port)) return true;
    const deadline = Date.now() + maxWait;
    while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (await isServerReady(port)) return true;
    }
    return false;
}

const WALKTHROUGH_SEEN_KEY = "storybookLauncher.walkthroughSeen";

function activate(context) {
    const walkthroughSeen = context.globalState.get(WALKTHROUGH_SEEN_KEY, false);

    if (!walkthroughSeen) {
        context.globalState.update(WALKTHROUGH_SEEN_KEY, true);
        vscode.commands.executeCommand(
            "workbench.action.openWalkthrough",
            { category: "element-hq.storybook-launcher#storybookLauncher.gettingStarted", step: "wait" },
            false,
        );
    }

    // --- Storybook status bar ---
    const sbItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    sbItem.text = "$(loading~spin) Storybook: Starting\u2026";
    sbItem.tooltip = "Storybook Playground is starting up — please wait";
    sbItem.show();
    context.subscriptions.push(sbItem);

    // --- Element Web status bar ---
    const ewItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    ewItem.text = "$(circle-outline) Element Web: Not Started";
    ewItem.tooltip = "Run \u2018pnpm run start:element-web\u2019 to start the app";
    ewItem.show();
    context.subscriptions.push(ewItem);

    context.subscriptions.push(
        vscode.commands.registerCommand("storybookLauncher.openInBrowser", openStorybookInBrowser),
        vscode.commands.registerCommand("storybookLauncher.openPreview", openStorybookPreview),
        vscode.commands.registerCommand("elementWebLauncher.openInBrowser", openElementWebInBrowser),
        vscode.commands.registerCommand("elementWebLauncher.openPreview", openElementWebPreview),
    );

    // Storybook boot sequence
    (async () => {
        const ready = await waitForServer(STORYBOOK_PORT, MAX_WAIT_MS);
        if (ready) {
            sbItem.text = "$(beaker) Storybook: Open \u25b8";
            sbItem.tooltip = "Storybook Playground is ready — click to open";
            sbItem.command = "storybookLauncher.openPreview";
            if (walkthroughSeen) await openStorybookPreview();
        } else {
            sbItem.text = "$(warning) Storybook: Not Started";
            sbItem.tooltip = "Storybook did not start. Try: pnpm run storybook:design";
        }
    })();

    // Element Web boot sequence — polls until ready (started on demand)
    (async () => {
        const ready = await waitForServer(ELEMENT_WEB_PORT, ELEMENT_WEB_MAX_WAIT_MS);
        if (ready) {
            ewItem.text = "$(globe) Element Web: Open \u25b8";
            ewItem.tooltip = "Element Web is ready — click to open";
            ewItem.command = "elementWebLauncher.openPreview";
            await openElementWebPreview();
        } else {
            ewItem.text = "$(circle-outline) Element Web: Not Started";
            ewItem.tooltip = "Run \u2018pnpm run start:element-web\u2019 to start the app";
        }
    })();
}

function deactivate() {}

module.exports = { activate, deactivate };

