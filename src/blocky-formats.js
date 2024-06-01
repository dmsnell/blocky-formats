/**
 * Converter of all things.
 *
 * @todo Preserve language for code blocks.
 */

// https://core.trac.wordpress.org/search?q=&noquickjump=1&ticket=on
// https://core.trac.wordpress.org/search?q=57381&noquickjump=1&changeset=on

const supportedBlocks = [
	'core/quote',
	'core/code',
	'core/heading',
	'core/html',
	'core/image',
	'core/list',
	'core/list-item',
	'core/missing',
	'core/paragraph',
	'core/table',
	'core/separator',
];

const go = () => {
	wp
		.blocks
		.getBlockTypes()
		.forEach(blockType => {
			if (!supportedBlocks.includes(blockType.name)) {
				wp.blocks.unregisterBlockType(blockType.name)
			} else if ('core/list-item' === blockType.name) {
				// Remove all sourcing data from block attribute definitions.
				wp.blocks.unregisterBlockType(blockType.name);
				const {allowedBlocks, ...newBlockType} = blockType;
				wp.blocks.registerBlockType(newBlockType.name, {...newBlockType});
			}
		})

	const TracExportSidebar = () => (
		wp.editPost.PluginSidebar({
			name: "blocky-formats-sidebar",
			title: "Export Post",
			icon: 'edit',
			children: (
				React.createElement(
					'ul',
					{},
					[
						React.createElement(
							wp.components.Button,
							{
								label: 'Import from Markdown',
								variant: 'primary',
								onClick: () => {
									navigator.clipboard.readText().then(
										markdown => window.loadFromMarkdown(markdown)
									);
								}
							},
							'Import from Markdown'
						),
						React.createElement(
							wp.components.Button,
							{
								label: 'Export to Markdown',
								variant: 'primary',
								onClick: () => {
									const markdown = window.saveToMarkdown();

									navigator.clipboard.writeText(markdown);
								}
							},
							'Export to Markdown'
						),
						React.createElement(
							wp.components.Button,
							{
								label: 'Export to Trac',
								variant: 'primary',
								onClick: () => {
									const trac = window.saveToTrac();

									navigator.clipboard.writeText(trac);
								}
							},
							'Export to Trac'
						)
					].map((e, i) => React.createElement('li', {key: i}, e))
				)
			)
		})
	);

	wp.plugins.registerPlugin('blocky-formats-sidebar', {render: TracExportSidebar});
}

const htmlToText = html => {
	const node = document.createElement('div');
	node.innerHTML = html;

	node.querySelectorAll('b, strong').forEach(
		fontNode => fontNode.innerHTML = `**${fontNode.innerHTML}**`
	);

	node.querySelectorAll('i, em').forEach(
		fontNode => fontNode.innerHTML = `//${fontNode.innerHTML}//`
	);

	node.querySelectorAll('code').forEach(
		codeNode => codeNode.innerHTML = `\`${codeNode.innerHTML}\``
	);

	node.querySelectorAll('a').forEach(
		linkNode => linkNode.outerHTML = `[${linkNode.getAttribute('href')} ${linkNode.innerText}]`
	);

	return node.innerText;
}

const blockToTrac = (state, block) => {
	/**
	 * Convert a number to Roman Numerals.
	 *
	 * @cite https://stackoverflow.com/a/9083076/486538
	 */
	const romanize = num => {
		const digits = String(+num).split('');
		const key = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM", "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC", "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
		let roman = "";
		let i = 3;
		while (i--) {
			roman = (key[+digits.pop() + (i * 10)] || "") + roman;
		}
		return Array(+digits.join("") + 1).join("M") + roman;
	};

	switch (block.name) {
		case 'core/quote':
			const content = blocksToTrac(state, block.innerBlocks);
			return content.split(/\n/g).map(l => `> ${l}`).join('\n') + '\n\n';

		case 'core/code':
			const code = htmlToText(block.attributes.content);
			const languageSpec = code.startsWith('<?php') ? `#!php` : '';
			return `{{{${languageSpec}\n${code}\n}}}\n\n`;

		case 'core/heading':
			return '='.repeat(block.attributes.level) + ' ' + htmlToText(block.attributes.content) + '\n\n';

		case 'core/list':
			state.indent++;
			state.listStyle.push({
				style: block.attributes.ordered ? (block.attributes.type || 'decimal') : '-',
				count: block.attributes.start || 1
			});
			const list = blocksToTrac(state, block.innerBlocks);
			state.listStyle.pop();
			state.indent--;
			return `${list}\n\n`;

		case 'core/list-item':
			if (0 === state.listStyle.length) {
				return '';
			}

			const item = state.listStyle[state.listStyle.length - 1];
			const bullet = (() => {
				switch (item.style) {
					case '-':
						return '-';

					case 'decimal':
						return `${item.count.toString()}.`;

					case 'upper-alpha': {
						let count = item.count;
						let bullet = '';
						while (count >= 1) {
							bullet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(count - 1) % 26] + bullet;
							count /= 26;
						}
						return `${bullet}.`;
					}

					case 'lower-alpha': {
						let count = item.count;
						let bullet = '';
						while (count >= 1) {
							bullet = 'abcdefghijklmnopqrstuvwxyz'[(count - 1) % 26] + bullet;
							count /= 26;
						}
						return `${bullet}.`;
					}

					case 'upper-roman':
						return romanize(item.count) + '.';

					case 'lower-roman':
						return romanize(item.count).toLowerCase();

					default:
						return `${item.count.toString()}.`;
				}
			})();

			item.count++;

			return `${'\t'.repeat(state.indent)}${bullet} ${htmlToText(block.attributes.content)}\n`;

		case 'core/paragraph':
			if ('undefined' === typeof window.lastContent) {
				window.lastContent = block.attributes.content;
			}
			console.log(window.lastContent);
			return htmlToText(block.attributes.content) + '\n\n';

		case 'core/separator':
			return '\n----\n\n';

		default:
			return '';
	}
}

const blocksToTrac = (state, blocks) => {
	return blocks.map(block => blockToTrac(state, block)).join('').replace(/^[\n\r]+|[\n\r]+$/g, '');
}

window.saveToTrac = () => {
	const state = {
		indent: 0,
		listStyle: [],
	};
	const blocks = wp.data.select('core/block-editor').getBlocks();
	const trac = blocksToTrac(state, blocks || []);
	console.log(trac);
	return trac;
}

const htmlToMarkdown = html => {
	const node = document.createElement('div');
	node.innerHTML = html;

	node.querySelectorAll('b, strong').forEach(
		fontNode => fontNode.innerHTML = `**${fontNode.innerHTML}**`
	);

	node.querySelectorAll('i, em').forEach(
		fontNode => fontNode.innerHTML = `*${fontNode.innerHTML}*`
	);

	node.querySelectorAll('code').forEach(
		codeNode => codeNode.innerHTML = `\`${codeNode.innerHTML}\``
	);

	node.querySelectorAll('a').forEach(
		// @todo Add link title.
		linkNode => linkNode.outerHTML = `[${linkNode.innerText}](${linkNode.getAttribute('href')})`
	);

	return node.innerText;
}

const blockToMarkdown = (state, block) => {
	/**
	 * Convert a number to Roman Numerals.
	 *
	 * @cite https://stackoverflow.com/a/9083076/486538
	 */
	const romanize = num => {
		const digits = String(+num).split('');
		const key = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM", "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC", "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
		let roman = "";
		let i = 3;
		while (i--) {
			roman = (key[+digits.pop() + (i * 10)] || "") + roman;
		}
		return Array(+digits.join("") + 1).join("M") + roman;
	};

	switch (block.name) {
		case 'core/quote':
			const content = blocksToTrac(state, block.innerBlocks);
			// @todo this probably fails on nested quotes - handle that.
			return content.split(/\n/g).map(l => `> ${l}`).join('\n') + '\n\n';

		case 'core/code':
			const code = htmlToMarkdown(block.attributes.content);
			const languageSpec = block.attributes.language || '';
			return `\`\`\`${languageSpec}\n${code}\n\`\`\`\n\n`;

		case 'core/heading':
			return '#'.repeat(block.attributes.level) + ' ' + htmlToMarkdown(block.attributes.content) + '\n\n';

		case 'core/list':
			state.indent++;
			state.listStyle.push({
				style: block.attributes.ordered ? (block.attributes.type || 'decimal') : '-',
				count: block.attributes.start || 1
			});
			const list = blocksToMarkdown(state, block.innerBlocks);
			state.listStyle.pop();
			state.indent--;
			return `${list}\n\n`;

		case 'core/list-item':
			if (0 === state.listStyle.length) {
				return '';
			}

			const item = state.listStyle[state.listStyle.length - 1];
			const bullet = (() => {
				switch (item.style) {
					case '-':
						return '-';

					case 'decimal':
						return `${item.count.toString()}.`;

					case 'upper-alpha': {
						let count = item.count;
						let bullet = '';
						while (count >= 1) {
							bullet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[(count - 1) % 26] + bullet;
							count /= 26;
						}
						return `${bullet}.`;
					}

					case 'lower-alpha': {
						let count = item.count;
						let bullet = '';
						while (count >= 1) {
							bullet = 'abcdefghijklmnopqrstuvwxyz'[(count - 1) % 26] + bullet;
							count /= 26;
						}
						return `${bullet}.`;
					}

					case 'upper-roman':
						return romanize(item.count) + '.';

					case 'lower-roman':
						return romanize(item.count).toLowerCase();

					default:
						return `${item.count.toString()}.`;
				}
			})();

			item.count++;

			return `${' '.repeat(state.indent)}${bullet} ${htmlToMarkdown(block.attributes.content)}\n`;

		case 'core/paragraph':
			return htmlToMarkdown(block.attributes.content) + '\n\n';

		case 'core/separator':
			return '\n---\n\n';

		default:
			console.log(block);
			return '';
	}
}

const blocksToMarkdown = (state, blocks) => {
	return blocks.map(block => blockToMarkdown(state, block)).join('').replace(/^[\n\r]+|[\n\r]+$/g, '');
}

window.saveToMarkdown = async () => {
	const { blocks2markdown } = await import('./markdown.js');
	const blocks = wp.data.select('core/block-editor').getBlocks();
	const markdown = blocks2markdown(blocks);
	console.log(markdown);
	return markdown;
}

window.loadFromMarkdown = async (input) => {
	const { markdownToBlocks } = await import('./markdown.js');

	const createBlocks = blocks => blocks.map(block => wp.blocks.createBlock(block.name, block.attributes, createBlocks(block.innerBlocks)));
	const blocks = markdownToBlocks(input);

	wp
		.data
		.dispatch('core/block-editor')
		.resetBlocks(createBlocks(blocks))
}

setTimeout(go, 1000);
