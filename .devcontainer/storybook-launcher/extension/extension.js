const http = require("node:http");
const vscode = require("vscode");

const STORYBOOK_PORT = 6007;
const STORYBOOK_PATH = "/?path=/story/ai-prototypes-get-started--setup-guide";
const STORYBOOK_LOCAL = `http://localhost:${STORYBOOK_PORT}${STORYBOOK_PATH}`;
const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 120_000;

/** Probe the local Storybook server. Returns true if it responds. */
function isStorybookReady() {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${STORYBOOK_PORT}/`, { timeout: 2000 }, (res) => {
            res.resume(); // drain
            resolve(res.statusCode < 500);
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * Resolve the Storybook URL to a form that VS Code's Simple Browser can load.
 * In Codespaces, asExternalUri rewrites localhost → the forwarded HTTPS URL.
 */
async function getStorybookUri() {
    return vscode.env.asExternalUri(vscode.Uri.parse(STORYBOOK_LOCAL));
}

async function openInBrowser() {
    const uri = await getStorybookUri();
    vscode.env.openExternal(uri);
}

async function openPreview() {
    const uri = await getStorybookUri();
    vscode.commands.executeCommand("simpleBrowser.show", uri.toString());
}

const WALKTHROUGH_SEEN_KEY = "storybookLauncher.walkthroughSeen";

function activate(context) {
    const walkthroughSeen = context.globalState.get(WALKTHROUGH_SEEN_KEY, false);

    if (!walkthroughSeen) {
        // First run — show the walkthrough and mark it as seen
        context.globalState.update(WALKTHROUGH_SEEN_KEY, true);
        vscode.commands.executeCommand(
            "workbench.action.openWalkthrough",
            { category: "element-hq.storybook-launcher#storybookLauncher.gettingStarted", step: "wait" },
            false,
        );
    }

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(loading~spin) Storybook: Starting\u2026";
    statusBarItem.tooltip = "Storybook Playground is starting up — please wait";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(
        vscode.commands.registerCommand("storybookLauncher.openInBrowser", openInBrowser),
        vscode.commands.registerCommand("storybookLauncher.openPreview", openPreview),
    );

    // Boot sequence — async fire-and-forget
    (async () => {
        let ready = await isStorybookReady();

        if (!ready) {
            const deadline = Date.now() + MAX_WAIT_MS;
            while (Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
                ready = await isStorybookReady();
                if (ready) break;
            }
        }

        if (ready) {
            statusBarItem.text = "$(beaker) Storybook: Open \u25b8";
            statusBarItem.tooltip = "Storybook Playground is ready — click to open";
            statusBarItem.command = "storybookLauncher.openPreview";
            // Only auto-open if the walkthrough was already seen (returning user)
            if (walkthroughSeen) {
                await openPreview();
            }
        } else {
            statusBarItem.text = "$(warning) Storybook: Not Started";
            statusBarItem.tooltip = "Storybook did not start. Try: pnpm run storybook:design";
        }
    })();
}

function deactivate() {}

module.exports = { activate, deactivate };

