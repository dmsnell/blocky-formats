<?php
/**
 * Plugin Name: Blocky Formats
 * Description: Use the Block Editor to edit other structural formats.
 * Author: Automattic, Inc.
 *
 * @package blocky-formats
 *
 * @todo Load commonmark from somewhere more normative and in control than unpkg.
 */

add_action(
	'init',
	static function() {
		wp_enqueue_script_module(
			'commonmark-parser',
			'https://unpkg.com/commonmark@0.31.0/dist/commonmark.min.js',
			array()
		);

		wp_enqueue_script_module(
			'blocky-formats',
			plugins_url( 'blocky-formats' ) . '/src/blocky-formats.js',
			array(
				'@wordpress/blocks',
				'@wordpress/components',
				'@wordpress/data',
				'@wordpress/block-editor',
				'@wordpress/icons',
				'@wordpress/plugins',
				'commonmark-parser',
			)
		);
	}
);
