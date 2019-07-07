const { BrowserWindow, ipcMain, dialog } = require('electron');
const { webContents, getCurrentWindow } = BrowserWindow;
const jetpack = require('fs-jetpack');
const spellchecker = require('spellchecker');
const path = require('path');
const mem = require('mem');

let app = null;
let enabledDictionaries = [];
let checker = null;
let dictionariesPath = null;
let dictionaries = null;
let isMultiLanguage = null;

const loadBundledDictionaries = async () => {
	const embeddedDictionaries = spellchecker.getAvailableDictionaries();
	const directory = jetpack.cwd(
		app.getAppPath(),
		app.getAppPath().endsWith('app.asar') ? '..' : './electron_app',
		'dictionaries',
	);
	const found = await directory.findAsync({ matching: '*.{aff,dic}' });
	const installedDictionaries = found.map((fileName) => path.basename(fileName, path.extname(fileName)));
	dictionariesPath = directory.path();
	dictionaries = Array.from(new Set([...embeddedDictionaries, ...installedDictionaries]))
		.sort()
		.map((x) => x.substring(0, 2));
	isMultiLanguage = embeddedDictionaries.length > 0 && process.platform !== 'win32';
};

const updateChecker = () => {
	try {
		if (enabledDictionaries.length === 0) {
			checker = () => true;
			return;
		}

		if (enabledDictionaries.length === 1) {
			let enabled = false;
			checker = mem((text) => {
				if (!enabled) {
					spellchecker.setDictionary(enabledDictionaries[0], dictionariesPath);
					enabled = true;
				}
				return !spellchecker.isMisspelled(text);
			});
			return;
		}

		const singleDictionaryChecker = mem(
			((dictionariesPath, dictionary, text) => {
				spellchecker.setDictionary(dictionary, dictionariesPath);
				return !spellchecker.isMisspelled(text);
			}).bind(null, dictionariesPath),
		);

		checker = mem(
			((dictionaries, text) => dictionaries.some((dictionary) => singleDictionaryChecker(dictionary, text))).bind(
				null,
				enabledDictionaries,
			),
		);
	} finally {
        // TODO: can't use it here, use IPC
		// webFrame.setSpellCheckProvider('', false, { spellCheck: checker });
	}
};

const enable = (...dictionaries) => {
	dictionaries = filterDictionaries(dictionaries);
	if (isMultiLanguage) {
		enabledDictionaries = [...enabledDictionaries, ...dictionaries];
	} else {
		enabledDictionaries = [dictionaries[0]];
	}

	updateChecker();
	return enabledDictionaries.length > 0;
};

const disable = (...dictionaries) => {
	dictionaries = filterDictionaries(dictionaries);

	enabledDictionaries = enabledDictionaries.filter((dictionary) => !dictionaries.includes(dictionary));

	updateChecker();
};

const filterDictionaries = (dictionaries) => {
	return dictionaries
		.flatMap((dictionary) => {
			const matches = /^(\w+?)[-_](\w+)$/.exec(dictionary);
			return matches
				? [`${matches[1]}_${matches[2]}`, `${matches[1]}-${matches[2]}`, matches[1]]
				: [dictionary];
		})
		.filter((dictionary) => dictionaries.includes(dictionary));
};

const isCorrect = (text) => {
	return checker(text);
};

const getCorrections = (text) => {
	text = text.trim();

	if (text === '' || isCorrect(text)) {
		return null;
	}

	return Array.from(
		new Set(
			enabledDictionaries.flatMap((language) => {
				spellchecker.setDictionary(language, dictionariesPath);
				return spellchecker.getCorrectionsForMisspelling(text);
			}),
		),
	);
};

const installDictionaries = async (filePaths) => {
	for (const filePath of filePaths) {
		const name = filePath.basename(filePath, filePath.extname(filePath));
		const basename = filePath.basename(filePath);
		const newPath = filePath.join(dictionariesPath, basename);

		await jetpack.copyAsync(filePath, newPath);

		if (!dictionaries.includes(name)) {
			dictionaries.push(name);
		}
	}
};

const getDictionariesSelectSubmenu = () => {
	return dictionaries
		.map((entry) => {
            console.log('enabledDicts', enabledDictionaries);
			return {
				label: entry,
				type: 'checkbox',
				checked: enabledDictionaries === entry,
				click: ({ checked }) => (checked ? enable(entry) : disable(entry)),
			};
		})
		.concat([
			{ type: 'separator' },
			{
				label: 'Browse for language',
				click: showDictionaryFileSelector,
			},
		]);
};

const getCorrectionsSubmenu = (text) => {
	const corrections = getCorrections(text);
	return [
		...(corrections
			? [
					...(corrections.length === 0
						? [
								{
									label: 'No spelling suggestions',
									enabled: false,
								},
							]
						: corrections.slice(0, 6).map((correction) => ({
								label: correction,
								click: () => webContents.getFocusedWebContents().replaceMisspelling(correction),
							}))),
					...(corrections.length > 6
						? [
								{
									label: 'More spelling suggestions',
									submenu: corrections.slice(6).map((correction) => ({
										label: correction,
										click: () => webContents.getFocusedWebContents().replaceMisspelling(correction),
									})),
								},
							]
						: []),
					{
						type: 'separator',
					},
				]
			: []),
	];
};

const spellCheckMenu = (textForSpellcheck) => {
	const spellingMenu = getCorrectionsSubmenu(textForSpellcheck)
		.concat([{ type: 'separator' }])
		.concat(getDictionariesSelectSubmenu());
	return [
		{
			label: 'Spell Checking',
			enabled: true,
			submenu: spellingMenu,
		},
		{
			type: 'separator',
		},
	];
};

const showDictionaryFileSelector = () => {
	dialog.showOpenDialog(
		getCurrentWindow(),
		{
			title: 'Load custom dictionary',
			defaultPath: dictionariesPath,
			filters: [
				{ name: 'Dictionaries', extensions: ['aff', 'dic'] },
				{ name: 'All files', extensions: ['*'] },
			],
			properties: ['openFile', 'multiSelections'],
		},
		async (filePaths) => {
			try {
				await installDictionaries(filePaths);
			} catch (error) {
				console.error(error);
				dialog.showErrorBox('Cannot load dictionary', 'Message', { message: error.message });
			}
		},
	);
};

module.exports = async (context) => {
    app = context;
    await loadBundledDictionaries();
	ipcMain.on('spellcheck:getcontextmenu', (event, arg) => {
        event.sender.send('spellcheck:getcontextmenu:result', spellCheckMenu(arg));
    });
    ipcMain.on('spellcheck:setlanguage', (event, arg) => {
        console.log('set language to', arg);
        enable(arg);
        event.sender.send('spellcheck:ready', { ready: true});
    });
    ipcMain.on('spellcheck:test', (event, arg) => {
        event.returnValue = checker(arg);
    });
    ipcMain.on('spellcheck:ismisspeled', (event, arg) => {
        event.returnValue = isCorrect(arg);
    });
    ipcMain.on('spellcheck:corrections', (event, arg) => {
        event.returnValue = getCorrections(arg);
    });
    ipcMain.on('spellchecker:add', (event, arg) => {
        console.log('customizing spellchecker is not supported yet');
    });
};
