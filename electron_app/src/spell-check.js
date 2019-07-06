const { remote, webFrame } = require('electron');
const { app, getCurrentWindow, Menu, webContents } = remote;
const jetpack = require('fs-jetpack');
const spellchecker = require('spellchecker');
const path = require('path');
const mem = require('mem');

this.enabledDictionaries = [];
this.checker = null;

const loadBundledDictionaries = async () => {
    const embeddedDictionaries = spellchecker.getAvailableDictionaries();
    const directory = jetpack.cwd(app.getAppPath(), app.getAppPath().endsWith('app.asar') ? '..' : './electron_app', 'dictionaries');
	const found = await directory.findAsync({ matching: '*.{aff,dic}' });
	const installedDictionaries = found.map((fileName) => path.basename(fileName, path.extname(fileName)));
	this.dictionariesPath = directory.path();
	this.dictionaries = Array.from(new Set([ ...embeddedDictionaries, ...installedDictionaries ])).sort().map(x => x.substring(0, 2));
	this.isMultiLanguage = embeddedDictionaries.length > 0 && process.platform !== 'win32';
};

const updateChecker = () => {
	try {
		if (this.enabledDictionaries.length === 0) {
			this.checker = () => true;
			return;
		}

		if (this.enabledDictionaries.length === 1) {
			let enabled = false;
			this.checker = mem((text) => {
				if (!enabled) {
					spellchecker.setDictionary(this.enabledDictionaries[0], this.dictionariesPath);
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
			}).bind(null, this.dictionariesPath)
		);

		this.checker = mem(
			((dictionaries, text) => dictionaries.some((dictionary) => singleDictionaryChecker(dictionary, text))).bind(
				null,
				this.enabledDictionaries
			)
		);
	} finally {
		webFrame.setSpellCheckProvider('', false, { spellCheck: this.checker });
	}
};

const enable = (...dictionaries) => {
	dictionaries = filterDictionaries(dictionaries);
	if (this.isMultiLanguage) {
		this.enabledDictionaries = [ ...this.enabledDictionaries, ...dictionaries ];
	} else {
		this.enabledDictionaries = [ dictionaries[0] ];
	}

	updateChecker();
	return this.enabledDictionaries.length > 0;
};

const disable = (...dictionaries) => {
	dictionaries = filterDictionaries(dictionaries);

	this.enabledDictionaries = this.enabledDictionaries.filter((dictionary) => !dictionaries.includes(dictionary));

	updateChecker();
};

const setDefaultEnabledDictionaries = () => {
	const selectedDictionaries = (() => {
		try {
            const enabledDictionaries = [this.dictionaries[this.dictionaries.indexOf(this.window.navigator.language)]] || [];
            return Array.isArray(enabledDictionaries) ? enabledDictionaries.map(String) : null;
		} catch (error) {
			console.error(error);
			return null;
		}
    })();
    if (selectedDictionaries) {
		enable(...selectedDictionaries);
		return;
	}

	const userLanguage = this.window.navigator.language;
	if (userLanguage && enable(this.userLanguage)) {
		return;
	}
};

const filterDictionaries = (dictionaries) => {
	return dictionaries
		.flatMap((dictionary) => {
			const matches = /^(\w+?)[-_](\w+)$/.exec(dictionary);
			return matches
				? [ `${matches[1]}_${matches[2]}`, `${matches[1]}-${matches[2]}`, matches[1] ]
				: [ dictionary ];
		})
		.filter((dictionary) => this.dictionaries.includes(dictionary));
};

const isCorrect = (text) => {
	return this.checker(text);
};

const getCorrections = (text) => {
	text = text.trim();

	if (text === '' || isCorrect(text)) {
		return null;
	}

	return Array.from(
		new Set(
			this.enabledDictionaries.flatMap((language) => {
				spellchecker.setDictionary(language, this.dictionariesPath);
				return spellchecker.getCorrectionsForMisspelling(text);
			})
		)
	);
};

const installDictionaries = async (filePaths) => {
	for (const filePath of filePaths) {
		const name = filePath.basename(filePath, filePath.extname(filePath));
		const basename = filePath.basename(filePath);
		const newPath = filePath.join(this.dictionariesPath, basename);

		await jetpack.copyAsync(filePath, newPath);

		if (!this.dictionaries.includes(name)) {
			this.dictionaries.push(name);
		}
	}
};

const getDictionariesSelectSubmenu = () => {
	return this.dictionaries
		.map((entry) => {
			return {
				label: entry,
				type: 'checkbox',
				checked: this.enabledDictionaries.includes(entry),
				click: ({ checked }) => (checked ? enable(entry) : disable(entry))
			};
		})
		.concat([
			{ type: 'separator' },
			{
				label: 'Browse for language',
				click: showDictionaryFileSelector
			}
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
									enabled: false
								}
							]
						: corrections.slice(0, 6).map((correction) => ({
								label: correction,
								click: () => webContents.getFocusedWebContents().replaceMisspelling(correction)
							}))),
					...(corrections.length > 6
						? [
								{
									label: 'More spelling suggestions',
									submenu: corrections.slice(6).map((correction) => ({
										label: correction,
										click: () => webContents.getFocusedWebContents().replaceMisspelling(correction)
									}))
								}
							]
						: []),
					{
						type: 'separator'
					}
				]
			: [])
	];
};

const createMenuTemplate = (textForSpellcheck) => {
	const standardMenus = [
		{
			label: 'Undo',
			role: 'undo',
			accelerator: 'CommandOrControl+Z'
		},
		{
			label: 'Redo',
			role: 'redo',
			accelerator: process.platform === 'win32' ? 'Control+Y' : 'CommandOrControl+Shift+Z'
		},
		{
			type: 'separator'
		},
		{
			label: 'Cut',
			role: 'cut',
			accelerator: 'CommandOrControl+X'
		},
		{
			label: 'Copy',
			role: 'copy',
			accelerator: 'CommandOrControl+C'
		},
		{
			label: 'Paste',
			role: 'paste',
			accelerator: 'CommandOrControl+V'
		},
		{
			label: 'Select All',
			role: 'selectall',
			accelerator: 'CommandOrControl+A'
		}
	];
	const spellingMenu = getCorrectionsSubmenu(textForSpellcheck)
		.concat([ { type: 'separator' } ])
		.concat(getDictionariesSelectSubmenu());
	return standardMenus.concat([
		{
			label: 'Spell Checking',
			enabled: true,
			submenu: spellingMenu
		},
		{
			type: 'separator'
		}
	]);
};

const showDictionaryFileSelector = () => {
	dialog.showOpenDialog(
		getCurrentWindow(),
		{
			title: 'Load custom dictionary',
			defaultPath: spellchecking.dictionariesPath,
			filters: [
				{ name: 'Dictionaries', extensions: [ 'aff', 'dic' ] },
				{ name: 'All files', extensions: [ '*' ] }
			],
			properties: [ 'openFile', 'multiSelections' ]
		},
		async (filePaths) => {
			try {
				await installDictionaries(filePaths);
			} catch (error) {
				console.error(error);
				dialog.showErrorBox('Cannot load dictionary', 'Message', { message: error.message });
			}
		}
	);
};

module.exports = async (window) => {
    this.window = window;
	await loadBundledDictionaries();
	setDefaultEnabledDictionaries();
	window.addEventListener('contextmenu', (event) => {
		if (event.target.isContentEditable) {
			event.preventDefault();
			setTimeout(() => {
				const menu = Menu.buildFromTemplate(createMenuTemplate(window.getSelection().toString()));
				menu.popup({ window: getCurrentWindow() });
			}, 30);
		}
	});
};
