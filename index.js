'use strict'

const { LOCALES } = require('./locales.js');
const { PuppeteerExtraPlugin } = require('puppeteer-extra-plugin');

/**
 * Force to fetch pages with certain language in puppeteer.
 *
 * @param {Object} [opts={}] - Plugin options
 * @param {String} [opts.language='en'] - Language to emulate
 * @param {Boolean} [opts.ip=true] - Enable/Disable ip spoofing technique
 * @param {Boolean} [opts.httpHeaders=true] - Enable/Disable HTTP-headers language related spoofing technique
 * @param {Boolean} [opts.geolocation=true] - Enable/Disable browser geolocation spoofing techinque
 * @param {Boolean} [opts.javascript=true] - Enable/Disable javascript spoofing technique
 *
 * @example
 * const puppeteer = require('puppeteer-extra')
 * puppeteer.use(require('puppeteer-extra-plugin-force-custom-language')())
 * // or
 * puppeteer.use(require('puppeteer-extra-plugin-force-custom-language')({language: 'es'}))
 * const browser = await puppeteer.launch()
 * // or
 * puppeteer.use(require('puppeteer-extra-plugin-force-custom-language')({
 * 		language: 'ru',
 * 		ip: true,
 * 		javascript: true,
 * 		geoLocation: true,
 * 		httpHeaders: true,
 *		requestInterceptionPriority: -1})
 * )
 * const browser = await puppeteer.launch()
 *
 * @author Marc Jorge <mjorge@voidentropy.com>
 * @version 1.0.0
 */
class ForceCustomLanguagePlugin extends PuppeteerExtraPlugin {
	constructor(opts = {}) {
		super(opts)
		if (opts?.language && Object.keys(LOCALES).includes(opts.language)) {
			this._locale = LOCALES[opts.language];
		} else {
			this._locale = LOCALES[this.defaults.language];
		}
	}

	get defaults() {
		return {
			language: 'en',
			ip: true,
			httpHeaders: true,
			geoLocation: true,
			javascript: true,
			requestInterceptionPriority: -1
		}
	}

	get name() {
		return 'force-custom-language';
	}

	get requirements() {
		return new Set(['runLast'])
	}

	async beforeLaunch(options) {
		options.devtools = true;
		options.args.push(`--lang=${this._locale.languageCode}`);
	}

	async onPageCreated(page) {
		if (this.opts.ip) {
			await page.setExtraHTTPHeaders({
				'X-Real-Ip': this._locale.ip,
				'X-Forwarded-For': this._locale.ip,
			});
		}

		if (this.opts.httpHeaders) {
			await page.setRequestInterception(true);
			page.on('request', (interceptedRequest) => {
				if (interceptedRequest.isInterceptResolutionHandled()) return;
				const headerOverride = interceptedRequest.headers();
				headerOverride['Accept-Language'] = `${this._locale.locale},${this._locale.languageCode}`;
				interceptedRequest.continue({
					headers: headerOverride,
				}, this.opts.requestInterceptionPriority);
			});
		}

		if (this.opts.geoLocation) await page.setGeolocation({latitude: this._locale.latitude, longitude: this._locale.longitude});

		if (this.opts.javascript) {
			await page.evaluateOnNewDocument((langs) => {
				Object.defineProperty(navigator, 'language', {
					get: function () {
						return langs[0];
					},
				});
				Object.defineProperty(navigator, 'languages', {
					get: function () {
						return langs[1];
					},
				});
			}, [this._locale.locale, [this._locale.locale, this._locale.languageCode]]);
		}
	}

	async onTargetChanged(target) {
		if (this.opts.geoLocation) {
			const _url = target.url();
			const _browser = target.browser();
			const ctx = _browser.defaultBrowserContext();
			try {
				//await ctx.clearPermissionOverrides();
				await ctx.overridePermissions(_url, ['geolocation']);
			} catch(e) {
				this.debug(`Cannot overridePermission on this site: ${_url}`);
			}
		}
	}
}

module.exports = function (pluginConfig) {
  return new ForceCustomLanguagePlugin(pluginConfig)
}
